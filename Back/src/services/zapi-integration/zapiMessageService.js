import { query } from "../../db/oracle.js"
import { getActivationTableNames } from "../../db/oracleObjectNames.js"
import {
  CAMPANHA_EVENTO,
  CAMPANHA_STATUS,
  ZAPI_BATCH_SIZE,
  ZAPI_BATCH_PAUSE_MS,
  ZAPI_DELAY_MAX_MS,
  ZAPI_DELAY_MIN_MS,
  appendNegotiationLink,
  ensureCampaignLinks,
  loadCampaignClients,
  registerCampaignEvent,
  updateCampaignClientStatus,
} from "../ativacaoClientesJourneyService.js"
import { isZapiConfigured, sendTextMessage } from "./zapiClient.js"

const campaignSendJobs = new Map()
let cachedActivationTables = null

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function texto(value) {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim()
  return normalized || null
}

function numero(value) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function randomDelayMs() {
  return ZAPI_DELAY_MIN_MS + Math.floor(Math.random() * (ZAPI_DELAY_MAX_MS - ZAPI_DELAY_MIN_MS + 1))
}

function normalizeJob(job) {
  return {
    campanha_id: job.campanhaId,
    status: job.status,
    started_at: job.startedAt,
    finished_at: job.finishedAt ?? null,
    processed: job.processed,
    total: job.total,
    success: job.success,
    failed: job.failed,
    skipped: job.skipped,
    batch_size: ZAPI_BATCH_SIZE,
    batch_pause_ms: ZAPI_BATCH_PAUSE_MS,
    delay_range_ms: [ZAPI_DELAY_MIN_MS, ZAPI_DELAY_MAX_MS],
    error: job.error ?? null,
  }
}

async function getActivationTables() {
  if (cachedActivationTables) {
    return cachedActivationTables
  }

  cachedActivationTables = await getActivationTableNames()
  return cachedActivationTables
}

async function loadCampaignHeader(campanhaId) {
  const tables = await getActivationTables()
  const rows = await query(
    `
    SELECT id, segmento, vendedor_id, mensagem_base
    FROM ${tables.campaignsTable}
    WHERE id = :id
    `,
    { id: campanhaId }
  )

  return rows[0] ?? null
}

async function markClientFailure(cliente, error) {
  await updateCampaignClientStatus({
    campanhaClienteId: cliente.campanha_cliente_id,
    statusEnvio: CAMPANHA_STATUS.FALHA,
    erroEnvio: error instanceof Error ? error.message : String(error),
    detalheStatus: {
      etapa: "envio_zapi",
      erro: error instanceof Error ? error.message : String(error),
    },
    ultimoEventoEm: new Date(),
  })
}

async function markClientSent(cliente, payload, mensagemFinal) {
  const sentAt = new Date()
  await updateCampaignClientStatus({
    campanhaClienteId: cliente.campanha_cliente_id,
    statusEnvio: CAMPANHA_STATUS.ENVIADO,
    mensagemFinal,
    messageId: payload?.messageId ?? payload?.id ?? null,
    zaapId: payload?.zaapId ?? null,
    detalheStatus: payload,
    erroEnvio: null,
    dataEnvioZapi: sentAt,
    ultimoEventoEm: sentAt,
  })

  await registerCampaignEvent({
    campanhaId: cliente.campanha_id,
    campanhaClienteId: cliente.campanha_cliente_id,
    clienteId: cliente.sk_cliente,
    tipoEvento: CAMPANHA_EVENTO.MENSAGEM_ENVIADA,
    detalhe: {
      messageId: payload?.messageId ?? payload?.id ?? null,
      zaapId: payload?.zaapId ?? null,
      via: "zapi",
    },
    dataEvento: sentAt,
  })
}

async function processCampaignQueue(job) {
  try {
    await ensureCampaignLinks(job.campanhaId)
    const clientes = await loadCampaignClients(job.campanhaId)
    const eligibleClients = clientes.filter((cliente) => {
      if (!cliente.possui_telefone) return false
      if (cliente.status_envio === CAMPANHA_STATUS.ENVIADO) return false
      if (cliente.status_envio === CAMPANHA_STATUS.ENTREGUE) return false
      if (cliente.status_envio === CAMPANHA_STATUS.LIDO) return false
      if (cliente.status_envio === CAMPANHA_STATUS.RESPONDIDO) return false
      return true
    })

    job.total = eligibleClients.length

    for (let index = 0; index < eligibleClients.length; index += 1) {
      const cliente = eligibleClients[index]
      job.processed += 1

      if (!cliente.possui_telefone || !texto(cliente.telefone)) {
        job.skipped += 1
        await markClientFailure(cliente, new Error("Cliente sem telefone valido para envio automatico."))
        continue
      }

      try {
        const mensagemFinal = appendNegotiationLink(cliente.mensagem_final, cliente.link_url)
        const response = await sendTextMessage({
          phone: cliente.telefone.startsWith("55") ? cliente.telefone : `55${cliente.telefone}`,
          message: mensagemFinal,
        })

        await markClientSent(cliente, response, mensagemFinal)
        job.success += 1
      } catch (error) {
        job.failed += 1
        await markClientFailure(cliente, error)
      }

      const isLast = index === eligibleClients.length - 1
      if (isLast) continue

      if ((index + 1) % ZAPI_BATCH_SIZE === 0) {
        await sleep(ZAPI_BATCH_PAUSE_MS)
      } else {
        await sleep(randomDelayMs())
      }
    }

    job.status = "completed"
    job.finishedAt = new Date().toISOString()
  } catch (error) {
    job.status = "failed"
    job.error = error instanceof Error ? error.message : String(error)
    job.finishedAt = new Date().toISOString()
  }
}

export function getCampaignSendJob(campanhaId) {
  const job = campaignSendJobs.get(String(campanhaId))
  return job ? normalizeJob(job) : null
}

export async function startCampaignSend(campanhaId) {
  if (!isZapiConfigured()) {
    throw new Error(
      "Configuracao Z-API incompleta. Preencha ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN e ZAPI_CLIENT_TOKEN antes de confirmar a campanha."
    )
  }

  const header = await loadCampaignHeader(campanhaId)
  if (!header) {
    throw new Error("Campanha de ativacao nao encontrada para envio.")
  }

  const jobKey = String(campanhaId)
  const existingJob = campaignSendJobs.get(jobKey)
  if (existingJob && existingJob.status === "processing") {
    return {
      started: false,
      campanha: {
        id: numero(header.ID ?? header.id),
        segmento: texto(header.SEGMENTO ?? header.segmento),
        vendedor_id: header.VENDEDOR_ID ?? header.vendedor_id ?? null,
        mensagem_base: texto(header.MENSAGEM_BASE ?? header.mensagem_base),
      },
      job: normalizeJob(existingJob),
    }
  }

  const job = {
    campanhaId: numero(header.ID ?? header.id),
    status: "processing",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    processed: 0,
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    error: null,
  }

  campaignSendJobs.set(jobKey, job)
  void processCampaignQueue(job)

  return {
    started: true,
    campanha: {
      id: job.campanhaId,
      segmento: texto(header.SEGMENTO ?? header.segmento),
      vendedor_id: header.VENDEDOR_ID ?? header.vendedor_id ?? null,
      mensagem_base: texto(header.MENSAGEM_BASE ?? header.mensagem_base),
    },
    job: normalizeJob(job),
  }
}

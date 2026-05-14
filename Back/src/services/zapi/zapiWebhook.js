import {
  CAMPANHA_EVENTO,
  CAMPANHA_STATUS,
  findCampaignClientByMessageIdentifier,
  findLatestCampaignClientByPhone,
  registerCampaignEvent,
  updateCampaignClientStatus,
} from "../ativacaoClientesJourneyService.js"

function texto(value) {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim()
  return normalized || null
}

function telefoneLimpo(value) {
  return String(value ?? "").replace(/\D/g, "")
}

function parseWebhookDate(value) {
  if (!value) return new Date()
  const parsed = new Date(Number(value))
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

async function findCampaignClientFromPayload(payload) {
  const identifiers = [
    payload?.messageId,
    payload?.id,
    payload?.zaapId,
    ...(Array.isArray(payload?.ids) ? payload.ids : []),
  ]
    .map((value) => texto(value))
    .filter(Boolean)

  for (const identifier of identifiers) {
    const cliente = await findCampaignClientByMessageIdentifier(identifier)
    if (cliente) {
      return cliente
    }
  }

  const phone = telefoneLimpo(payload?.phone)
  if (phone) {
    return findLatestCampaignClientByPhone(phone)
  }

  return null
}

async function processDeliveryCallback(payload) {
  const cliente = await findCampaignClientFromPayload(payload)
  if (!cliente) {
    return { matched: false, type: "DeliveryCallback" }
  }

  const eventDate = parseWebhookDate(payload?.momment)
  const hasError = Boolean(texto(payload?.error))
  await updateCampaignClientStatus({
    campanhaClienteId: cliente.id,
    statusEnvio: hasError ? CAMPANHA_STATUS.FALHA : CAMPANHA_STATUS.ENVIADO,
    messageId: payload?.messageId ?? payload?.id ?? null,
    zaapId: payload?.zaapId ?? null,
    detalheStatus: payload,
    erroEnvio: hasError ? payload.error : null,
    ultimoEventoEm: eventDate,
  })

  if (!hasError) {
    await registerCampaignEvent({
      campanhaId: cliente.campanha_id,
      campanhaClienteId: cliente.id,
      clienteId: cliente.sk_cliente,
      tipoEvento: CAMPANHA_EVENTO.MENSAGEM_ENVIADA,
      detalhe: {
        source: "delivery_webhook",
        messageId: payload?.messageId ?? payload?.id ?? null,
      },
      dataEvento: eventDate,
    })
  }

  return {
    matched: true,
    type: "DeliveryCallback",
    campanha_cliente_id: cliente.id,
  }
}

async function processStatusCallback(payload) {
  const status = String(payload?.status ?? "").trim().toUpperCase()
  const cliente = await findCampaignClientFromPayload(payload)
  if (!cliente) {
    return { matched: false, type: "MessageStatusCallback", status }
  }

  const eventDate = parseWebhookDate(payload?.momment)
  let statusEnvio = null
  let tipoEvento = null

  if (status === "SENT") {
    statusEnvio = CAMPANHA_STATUS.ENVIADO
    tipoEvento = CAMPANHA_EVENTO.MENSAGEM_ENVIADA
  } else if (status === "RECEIVED") {
    statusEnvio = CAMPANHA_STATUS.ENTREGUE
    tipoEvento = CAMPANHA_EVENTO.MENSAGEM_ENTREGUE
  } else if (status === "READ") {
    statusEnvio = CAMPANHA_STATUS.LIDO
    tipoEvento = CAMPANHA_EVENTO.MENSAGEM_LIDA
  }

  if (statusEnvio) {
    await updateCampaignClientStatus({
      campanhaClienteId: cliente.id,
      statusEnvio,
      detalheStatus: payload,
      ultimoEventoEm: eventDate,
    })
  }

  if (tipoEvento) {
    await registerCampaignEvent({
      campanhaId: cliente.campanha_id,
      campanhaClienteId: cliente.id,
      clienteId: cliente.sk_cliente,
      tipoEvento,
      detalhe: {
        source: "status_webhook",
        status,
        ids: payload?.ids ?? null,
      },
      dataEvento: eventDate,
    })
  }

  return {
    matched: true,
    type: "MessageStatusCallback",
    status,
    campanha_cliente_id: cliente.id,
  }
}

async function processReceivedCallback(payload) {
  if (payload?.fromMe) {
    return { matched: false, type: "ReceivedCallback", ignored: "from_me" }
  }

  const cliente = await findCampaignClientFromPayload(payload)
  if (!cliente) {
    return { matched: false, type: "ReceivedCallback" }
  }

  const eventDate = parseWebhookDate(payload?.momment)
  const messagePreview =
    texto(payload?.text?.message) ||
    texto(payload?.text?.description) ||
    texto(payload?.notification) ||
    "Mensagem recebida"

  await updateCampaignClientStatus({
    campanhaClienteId: cliente.id,
    statusEnvio: CAMPANHA_STATUS.RESPONDIDO,
    detalheStatus: payload,
    ultimoEventoEm: eventDate,
  })

  await registerCampaignEvent({
    campanhaId: cliente.campanha_id,
    campanhaClienteId: cliente.id,
    clienteId: cliente.sk_cliente,
    tipoEvento: CAMPANHA_EVENTO.CLIENTE_RESPONDEU,
    detalhe: {
      source: "receive_webhook",
      preview: messagePreview,
      phone: texto(payload?.phone),
    },
    dataEvento: eventDate,
  })

  return {
    matched: true,
    type: "ReceivedCallback",
    campanha_cliente_id: cliente.id,
  }
}

export async function processZapiWebhook(payload) {
  const type = String(payload?.type ?? "").trim()

  if (type === "DeliveryCallback") {
    return processDeliveryCallback(payload)
  }

  if (type === "MessageStatusCallback") {
    return processStatusCallback(payload)
  }

  if (type === "ReceivedCallback") {
    return processReceivedCallback(payload)
  }

  if (payload?.status && payload?.ids) {
    return processStatusCallback(payload)
  }

  if (payload?.messageId || payload?.zaapId) {
    return processDeliveryCallback(payload)
  }

  if (payload?.phone && (payload?.text || payload?.notification)) {
    return processReceivedCallback(payload)
  }

  return {
    matched: false,
    type: type || "unknown",
    ignored: true,
  }
}

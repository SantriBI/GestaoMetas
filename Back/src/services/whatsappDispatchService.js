import { queryOracleByEmpresaId } from "../db/oracle-tenants.js"
import { sendTextMessage } from "./evolutionApiService.js"

function getScopedQuery(empresaId) {
  if (!empresaId) {
    throw new Error("empresa_id e obrigatorio para atualizar campanha WhatsApp.")
  }
  return (sql, binds = {}, options = {}) => queryOracleByEmpresaId(empresaId, sql, binds, options)
}

async function tableExists(tableName, dbQuery) {
  const rows = await dbQuery(
    `
    SELECT COUNT(*) AS total
    FROM USER_TABLES
    WHERE TABLE_NAME = :table_name
    `,
    { table_name: String(tableName ?? "").toUpperCase() }
  )

  return Number(rows[0]?.TOTAL ?? rows[0]?.total ?? 0) > 0
}

export function limparNumeroWhatsApp(telefone) {
  const limpo = String(telefone ?? "").replace(/\D/g, "")

  if (limpo.length === 8 || limpo.length === 9) {
    return null
  }

  if (limpo.length === 10 || limpo.length === 11) {
    return `55${limpo}`
  }

  if ((limpo.length === 12 || limpo.length === 13) && limpo.startsWith("55")) {
    return limpo
  }

  return null
}

function randomDelayMs() {
  const min = Number(process.env.EVOLUTION_DELAY_MIN_MS ?? 8000)
  const max = Number(process.env.EVOLUTION_DELAY_MAX_MS ?? 15000)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function atualizarStatusEnvio(campanhaId, skCliente, status, dbQuery) {
  if (!(await tableExists("GM_TB_CAMPANHAS_ATIVACAO_CLIENTES", dbQuery))) {
    return
  }

  await dbQuery(
    `
    UPDATE GM_TB_CAMPANHAS_ATIVACAO_CLIENTES
    SET status_envio = :status_envio
    WHERE campanha_id = :campanha_id AND sk_cliente = :sk_cliente
    `,
    { status_envio: status, campanha_id: campanhaId, sk_cliente: skCliente }
  )
}

export async function dispatchCampanha({ instanceName, clientes, campanhaId, empresaId, onProgress }) {
  const dbQuery = getScopedQuery(empresaId)
  const elegiveis = (clientes ?? [])
    .map((cliente) => ({ cliente, numero: limparNumeroWhatsApp(cliente.telefone) }))
    .filter(({ numero }) => Boolean(numero))

  const resultados = []
  let total_enviados = 0
  let total_erros = 0

  for (let index = 0; index < elegiveis.length; index += 1) {
    const { cliente, numero } = elegiveis[index]

    let status = "ENVIADO_EVOLUTION"
    let erro = null

    try {
      await sendTextMessage(instanceName, numero, cliente.mensagem_final)
      total_enviados += 1
    } catch (err) {
      status = "ERRO_EVOLUTION"
      erro = err.message
      total_erros += 1
      console.error(`Erro ao enviar mensagem Evolution API para ${numero}:`, err)
    }

    await atualizarStatusEnvio(campanhaId, cliente.sk_cliente, status, dbQuery)

    const resultado = {
      sk_cliente: cliente.sk_cliente,
      nome_cliente: cliente.nome_cliente,
      telefone: numero,
      status,
      ...(erro ? { erro } : {}),
    }
    resultados.push(resultado)

    if (typeof onProgress === "function") {
      onProgress(resultado)
    }

    if (index < elegiveis.length - 1) {
      await sleep(randomDelayMs())
    }
  }

  return { total_enviados, total_erros, resultados }
}

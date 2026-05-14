import { randomBytes } from "crypto"
import { query } from "../db/oracle.js"
import { getActivationTableNames, getUsersTableName } from "../db/oracleObjectNames.js"

export const LARGE_CAMPAIGN_WARNING_THRESHOLD = 150
export const ZAPI_BATCH_SIZE = 50
export const ZAPI_BATCH_PAUSE_MS = 2 * 60 * 1000
export const ZAPI_DELAY_MIN_MS = 3 * 1000
export const ZAPI_DELAY_MAX_MS = 8 * 1000

export const CAMPANHA_STATUS = {
  PENDENTE: "PENDENTE",
  ENVIADO: "ENVIADO",
  ENTREGUE: "ENTREGUE",
  LIDO: "LIDO",
  RESPONDIDO: "RESPONDIDO",
  FALHA: "FALHA",
}

export const CAMPANHA_EVENTO = {
  MENSAGEM_ENVIADA: "MENSAGEM_ENVIADA",
  MENSAGEM_ENTREGUE: "MENSAGEM_ENTREGUE",
  MENSAGEM_LIDA: "MENSAGEM_LIDA",
  CLIENTE_RESPONDEU: "CLIENTE_RESPONDEU",
  LINK_ABERTO: "LINK_ABERTO",
  NEGOCIACAO_INICIADA: "NEGOCIACAO_INICIADA",
  ORCAMENTO_SOLICITADO: "ORCAMENTO_SOLICITADO",
  VENDA_GERADA: "VENDA_GERADA",
}

const NEGOTIATION_CARD_CATALOG = [
  {
    id: "promocoes",
    badge: "Promocoes",
    title: "Condicoes especiais preparadas para voce",
    description:
      "Separamos oportunidades com prioridade comercial, condicoes mais simples de aprovar e contato agil com o time SIP.",
  },
  {
    id: "recomendados",
    badge: "Recomendados",
    title: "Produtos sugeridos para o seu momento",
    description:
      "Aproveite uma selecao inicial pensada para acelerar a decisao e reduzir o tempo entre interesse e fechamento.",
  },
  {
    id: "orcamento",
    badge: "Orcamento",
    title: "Solicite um retorno personalizado",
    description:
      "Peça um orcamento rapido e receba apoio do vendedor para montar a melhor combinacao de itens e condicoes.",
  },
  {
    id: "novidades",
    badge: "Novidades",
    title: "Descubra o que chegou agora",
    description:
      "Reunimos lancamentos, ajustes recentes de portfolio e movimentos comerciais que podem gerar vantagem imediata.",
  },
  {
    id: "oportunidades",
    badge: "Oportunidades",
    title: "Abra uma negociacao sem friccao",
    description:
      "Em poucos toques voce consegue sinalizar interesse, iniciar a conversa e receber atendimento premium pelo WhatsApp.",
  },
]

let cachedAdvancedCampaignSupport = null
let cachedUserProfileColumns = null
let cachedActivationTables = null

function normalizarLinha(row) {
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
}

function numero(value) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function numeroOuNull(value) {
  if (value === null || value === undefined) return null
  if (typeof value === "string" && !value.trim()) return null

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function texto(value) {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim()
  return normalized || null
}

function textoCurto(value, maxLength = 1000) {
  const normalized = texto(value)
  if (!normalized) return null
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized
}

function parseOracleDate(value) {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const raw = String(value).trim()
  if (!raw) return null

  if (/^\d{8}$/.test(raw)) {
    const parsed = new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function telefoneLimpo(value) {
  return String(value ?? "").replace(/\D/g, "")
}

function telefoneValido(value) {
  const limpo = telefoneLimpo(value)
  return limpo.length >= 10 ? limpo : null
}

function telefoneWhatsapp(value) {
  const limpo = telefoneValido(value)
  if (!limpo) return null
  return limpo.startsWith("55") ? limpo : `55${limpo}`
}

function escapeWhatsAppMessage(value) {
  return encodeURIComponent(value).replace(/%20/g, "+")
}

function buildWhatsAppLink(phone, message) {
  const numeroWhatsapp = telefoneWhatsapp(phone)
  if (!numeroWhatsapp) return null
  return `https://wa.me/${numeroWhatsapp}?text=${escapeWhatsAppMessage(message)}`
}

function signedRevenueSql(alias = "f") {
  return `
    CASE
      WHEN ${alias}.tipo = 'DEV' THEN NVL(${alias}.valor_liquido_item, 0) * -1
      ELSE NVL(${alias}.valor_liquido_item, 0)
    END
  `
}

export function buildCampaignWarning(totalClientes) {
  return totalClientes > LARGE_CAMPAIGN_WARNING_THRESHOLD
    ? "Campanhas muito grandes podem aumentar o risco de limitacao do WhatsApp."
    : null
}

function buildPublicBaseUrl() {
  const configured = texto(process.env.SIP_PUBLIC_URL)
  if (configured) {
    return configured.replace(/\/$/, "")
  }

  return "http://localhost:3000"
}

function buildNegotiationPrompt(clientName, sellerName) {
  return `Ola ${sellerName || "time SIP"}, quero falar sobre as condicoes especiais. Sou ${clientName || "cliente"}.`
}

function buildNegotiationCards(client, campaign) {
  const baseClassification = texto(client.classificacao_rfv) ?? texto(campaign.segmento) ?? "Carteira VIP"

  return NEGOTIATION_CARD_CATALOG.map((card, index) => ({
    ...card,
    tone: index % 2 === 0 ? "emerald" : "slate",
    eyebrow: baseClassification,
  }))
}

async function tableExists(tableName) {
  const rows = await query(
    `
    SELECT COUNT(*) AS total
    FROM USER_TABLES
    WHERE TABLE_NAME = :table_name
    `,
    { table_name: String(tableName ?? "").toUpperCase() }
  )

  return numero(rows[0]?.TOTAL ?? rows[0]?.total) > 0
}

async function tableHasColumns(tableName, columnNames) {
  if (!columnNames.length) return true

  const normalizedColumns = columnNames.map((columnName) => `'${String(columnName).toUpperCase()}'`).join(", ")
  const rows = await query(
    `
    SELECT COUNT(*) AS total
    FROM USER_TAB_COLUMNS
    WHERE TABLE_NAME = :table_name
      AND COLUMN_NAME IN (${normalizedColumns})
    `,
    { table_name: String(tableName ?? "").toUpperCase() }
  )

  return numero(rows[0]?.TOTAL ?? rows[0]?.total) >= columnNames.length
}

async function nextTableId(tableName) {
  const rows = await query(`SELECT NVL(MAX(id), 0) + 1 AS next_id FROM ${tableName}`)
  return numero(rows[0]?.NEXT_ID ?? rows[0]?.next_id)
}

async function getActivationTables() {
  if (cachedActivationTables) {
    return cachedActivationTables
  }

  cachedActivationTables = await getActivationTableNames()
  return cachedActivationTables
}

async function loadUserProfileColumns() {
  if (cachedUserProfileColumns !== null) {
    return cachedUserProfileColumns
  }

  const userTable = await getUsersTableName()
  const tableName = userTable.split(".").pop()

  const rows = await query(
    `
    SELECT COLUMN_NAME
    FROM USER_TAB_COLUMNS
    WHERE TABLE_NAME = :table_name
      AND COLUMN_NAME IN ('FOTO_URL', 'TELEFONE', 'WHATSAPP', 'CELULAR')
    `,
    { table_name: tableName }
  )

  const available = new Set(rows.map((row) => String(row.COLUMN_NAME ?? row.column_name ?? "").toUpperCase()))
  cachedUserProfileColumns = {
    userTable,
    hasFotoUrl: available.has("FOTO_URL"),
    phoneColumn: available.has("WHATSAPP")
      ? "whatsapp"
      : available.has("TELEFONE")
        ? "telefone"
        : available.has("CELULAR")
          ? "celular"
          : null,
  }

  return cachedUserProfileColumns
}

export async function hasAdvancedCampaignSupport() {
  if (cachedAdvancedCampaignSupport === true) {
    return cachedAdvancedCampaignSupport
  }

  const tables = await getActivationTables()
  const hasSupport =
    (await tableExists(tables.campaignLinksTable)) &&
    (await tableExists(tables.campaignEventsTable)) &&
    (await tableHasColumns(tables.campaignClientsTable, [
      "LINK_TOKEN",
      "LINK_URL",
      "MESSAGE_ID",
      "ZAPI_ZAAP_ID",
      "DATA_ENVIO_ZAPI",
      "DETALHE_STATUS",
      "ERRO_ENVIO",
      "ULTIMO_EVENTO_EM",
    ]))

  cachedAdvancedCampaignSupport = hasSupport ? true : null
  return hasSupport
}

export async function assertAdvancedCampaignSupport() {
  if (await hasAdvancedCampaignSupport()) {
    return true
  }

  throw new Error(
    "A estrutura avancada da ativacao ainda nao foi criada. Execute o script Back/sql/campanhas_ativacao_zapi.sql antes de usar Z-API e a Central de Negociacao."
  )
}

async function generateUniqueToken() {
  await assertAdvancedCampaignSupport()
  const tables = await getActivationTables()

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const token = randomBytes(9).toString("base64url")
    const rows = await query(
      `
      SELECT COUNT(*) AS total
      FROM ${tables.campaignLinksTable}
      WHERE token = :token
      `,
      { token }
    )

    if (numero(rows[0]?.TOTAL ?? rows[0]?.total) === 0) {
      return token
    }
  }

  throw new Error("Nao foi possivel gerar um token unico para a Central de Negociacao.")
}

export function appendNegotiationLink(message, linkUrl) {
  const sanitizedMessage = String(message ?? "").trim()
  const sanitizedLink = texto(linkUrl)

  if (!sanitizedMessage) return ""

  const escapedLink = sanitizedLink ? sanitizedLink.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : null
  const blockPattern = escapedLink
    ? new RegExp(`\\n*\\s*Clique aqui para condicoes especiais:\\s*\\n\\s*${escapedLink}\\s*$`, "i")
    : /\n*\s*Clique aqui para condicoes especiais:\s*\n\s*https?:\/\/\S+\s*$/i

  return sanitizedMessage.replace(blockPattern, "").trim()
}

export function buildNegotiationLink(token) {
  return `${buildPublicBaseUrl()}/n/${token}`
}

export function serializeCampaignDetail(detail) {
  if (detail === null || detail === undefined) return null
  if (typeof detail === "string") return textoCurto(detail, 1900)

  try {
    return textoCurto(JSON.stringify(detail), 1900)
  } catch {
    return textoCurto(String(detail), 1900)
  }
}

export async function registerCampaignEvent({
  campanhaId,
  campanhaClienteId,
  clienteId,
  tipoEvento,
  detalhe,
  dataEvento,
}) {
  await assertAdvancedCampaignSupport()
  const tables = await getActivationTables()

  const id = await nextTableId(tables.campaignEventsTable)
  await query(
    `
    INSERT INTO ${tables.campaignEventsTable} (
      id,
      campanha_id,
      campanha_cliente_id,
      cliente_id,
      tipo_evento,
      detalhe,
      data_evento
    ) VALUES (
      :id,
      :campanha_id,
      :campanha_cliente_id,
      :cliente_id,
      :tipo_evento,
      :detalhe,
      :data_evento
    )
    `,
    {
      id,
      campanha_id: campanhaId,
      campanha_cliente_id: campanhaClienteId ?? null,
      cliente_id: clienteId ?? null,
      tipo_evento: tipoEvento,
      detalhe: serializeCampaignDetail(detalhe),
      data_evento: parseOracleDate(dataEvento) ?? new Date(),
    }
  )

  return id
}

export async function campaignEventExists(campanhaId, campanhaClienteId, tipoEvento) {
  await assertAdvancedCampaignSupport()
  const tables = await getActivationTables()

  const rows = await query(
    `
    SELECT COUNT(*) AS total
    FROM ${tables.campaignEventsTable}
    WHERE campanha_id = :campanha_id
      AND campanha_cliente_id = :campanha_cliente_id
      AND tipo_evento = :tipo_evento
    `,
    {
      campanha_id: campanhaId,
      campanha_cliente_id: campanhaClienteId,
      tipo_evento: tipoEvento,
    }
  )

  return numero(rows[0]?.TOTAL ?? rows[0]?.total) > 0
}

export async function loadCampaignClients(campanhaId) {
  const tables = await getActivationTables()
  const rows = await query(
    `
    SELECT
      c.id,
      c.campanha_id,
      c.sk_cliente,
      c.nome_cliente,
      c.telefone,
      c.classificacao_rfv,
      c.ultima_compra,
      c.valor_orcamento,
      c.data_orcamento,
      c.mensagem_final,
      c.status_envio,
      c.link_token,
      c.link_url,
      c.message_id,
      c.zapi_zaap_id,
      c.data_envio_zapi,
      c.detalhe_status,
      c.erro_envio,
      c.ultimo_evento_em,
      l.id AS link_id,
      l.token AS token_link,
      l.link_url AS link_url_relacionado,
      l.total_cliques,
      l.primeiro_clique,
      l.ultimo_clique,
      l.converteu,
      l.valor_conversao
    FROM ${tables.campaignClientsTable} c
    LEFT JOIN ${tables.campaignLinksTable} l
      ON l.campanha_cliente_id = c.id
    WHERE c.campanha_id = :campanha_id
    ORDER BY c.id
    `,
    { campanha_id: campanhaId }
  )

  return rows.map((row, index) => {
    const item = normalizarLinha(row)
    const phone = telefoneValido(item.telefone)
    const linkUrl = texto(item.link_url) || texto(item.link_url_relacionado)
    const mensagemFinal = appendNegotiationLink(item.mensagem_final, linkUrl)

    return {
      id: String(item.id ?? `${campanhaId}-${index}`),
      campanha_cliente_id: numeroOuNull(item.id),
      campanha_id: numeroOuNull(item.campanha_id),
      sk_cliente: item.sk_cliente ?? null,
      nome_cliente: texto(item.nome_cliente),
      telefone: phone,
      classificacao_rfv: texto(item.classificacao_rfv),
      ultima_compra: item.ultima_compra ?? null,
      total_compras: null,
      valor_potencial: 0,
      valor_orcamento: numeroOuNull(item.valor_orcamento),
      data_orcamento: item.data_orcamento ?? null,
      origem: "rfv",
      possui_telefone: Boolean(phone),
      mensagem_final: mensagemFinal,
      whatsapp_link: phone ? buildWhatsAppLink(phone, mensagemFinal) : null,
      link_token: texto(item.link_token) || texto(item.token_link),
      link_url: linkUrl,
      message_id: texto(item.message_id),
      zapi_zaap_id: texto(item.zapi_zaap_id),
      data_envio_zapi: item.data_envio_zapi ?? null,
      detalhe_status: texto(item.detalhe_status),
      erro_envio: texto(item.erro_envio),
      ultimo_evento_em: item.ultimo_evento_em ?? null,
      status_envio: texto(item.status_envio) ?? CAMPANHA_STATUS.PENDENTE,
      total_cliques: numero(item.total_cliques),
      primeiro_clique: item.primeiro_clique ?? null,
      ultimo_clique: item.ultimo_clique ?? null,
      converteu: String(item.converteu ?? "N").toUpperCase() === "S",
      valor_conversao: numeroOuNull(item.valor_conversao),
      link_id: numeroOuNull(item.link_id),
    }
  })
}

export async function ensureCampaignLinks(campanhaId) {
  await assertAdvancedCampaignSupport()
  const tables = await getActivationTables()

  const rows = await query(
    `
    SELECT
      c.id,
      c.campanha_id,
      c.sk_cliente,
      c.nome_cliente,
      c.telefone,
      c.classificacao_rfv,
      c.ultima_compra,
      c.valor_orcamento,
      c.data_orcamento,
      c.mensagem_final,
      l.id AS link_id,
      l.token,
      l.link_url
    FROM ${tables.campaignClientsTable} c
    LEFT JOIN ${tables.campaignLinksTable} l
      ON l.campanha_cliente_id = c.id
    WHERE c.campanha_id = :campanha_id
    ORDER BY c.id
    `,
    { campanha_id: campanhaId }
  )

  for (const row of rows) {
    const item = normalizarLinha(row)
    const token = texto(item.token) ?? (await generateUniqueToken())
    const linkUrl = texto(item.link_url) ?? buildNegotiationLink(token)
    const mensagemFinal = appendNegotiationLink(item.mensagem_final, linkUrl)

    if (!item.link_id) {
      const id = await nextTableId(tables.campaignLinksTable)
      await query(
        `
        INSERT INTO ${tables.campaignLinksTable} (
          id,
          token,
          campanha_id,
          campanha_cliente_id,
          cliente_id,
          vendedor_id,
          link_url,
          total_cliques,
          converteu,
          data_criacao
        ) VALUES (
          :id,
          :token,
          :campanha_id,
          :campanha_cliente_id,
          :cliente_id,
          (
            SELECT vendedor_id
            FROM ${tables.campaignsTable}
            WHERE id = :campanha_id
          ),
          :link_url,
          0,
          'N',
          SYSDATE
        )
        `,
        {
          id,
          token,
          campanha_id: campanhaId,
          campanha_cliente_id: item.id,
          cliente_id: item.sk_cliente ?? null,
          link_url: linkUrl,
        }
      )
    }

    await query(
      `
      UPDATE ${tables.campaignClientsTable}
      SET link_token = :link_token,
          link_url = :link_url,
          mensagem_final = :mensagem_final
      WHERE id = :id
      `,
      {
        id: item.id,
        link_token: token,
        link_url: linkUrl,
        mensagem_final: mensagemFinal,
      }
    )
  }

  return loadCampaignClients(campanhaId)
}

export async function updateCampaignClientStatus({
  campanhaClienteId,
  statusEnvio,
  mensagemFinal,
  messageId,
  zaapId,
  detalheStatus,
  erroEnvio,
  dataEnvioZapi,
  ultimoEventoEm,
}) {
  const tables = await getActivationTables()
  await query(
    `
    UPDATE ${tables.campaignClientsTable}
    SET status_envio = COALESCE(:status_envio, status_envio),
        mensagem_final = COALESCE(:mensagem_final, mensagem_final),
        message_id = COALESCE(:message_id, message_id),
        zapi_zaap_id = COALESCE(:zapi_zaap_id, zapi_zaap_id),
        detalhe_status = COALESCE(:detalhe_status, detalhe_status),
        erro_envio = COALESCE(:erro_envio, erro_envio),
        data_envio_zapi = COALESCE(:data_envio_zapi, data_envio_zapi),
        ultimo_evento_em = COALESCE(:ultimo_evento_em, ultimo_evento_em)
    WHERE id = :id
    `,
    {
      id: campanhaClienteId,
      status_envio: statusEnvio ?? null,
      mensagem_final: texto(mensagemFinal),
      message_id: texto(messageId),
      zapi_zaap_id: texto(zaapId),
      detalhe_status: serializeCampaignDetail(detalheStatus),
      erro_envio: textoCurto(erroEnvio, 900),
      data_envio_zapi: parseOracleDate(dataEnvioZapi),
      ultimo_evento_em: parseOracleDate(ultimoEventoEm),
    }
  )
}

export async function findCampaignClientByMessageIdentifier(messageIdentifier) {
  const identifier = texto(messageIdentifier)
  if (!identifier) return null
  const tables = await getActivationTables()

  const rows = await query(
    `
    SELECT *
    FROM (
      SELECT
        c.id,
        c.campanha_id,
        c.sk_cliente,
        c.nome_cliente,
        c.telefone,
        c.message_id,
        c.zapi_zaap_id,
        c.status_envio
      FROM ${tables.campaignClientsTable} c
      WHERE c.message_id = :message_id
         OR c.zapi_zaap_id = :message_id
      ORDER BY NVL(c.data_envio_zapi, SYSDATE) DESC, c.id DESC
    )
    WHERE ROWNUM = 1
    `,
    { message_id: identifier }
  )

  return rows[0] ? normalizarLinha(rows[0]) : null
}

export async function findLatestCampaignClientByPhone(phone) {
  const normalizedPhone = telefoneWhatsapp(phone)
  if (!normalizedPhone) return null

  const rawPhone = normalizedPhone.replace(/^55/, "")
  const tables = await getActivationTables()
  const rows = await query(
    `
    SELECT *
    FROM (
      SELECT
        c.id,
        c.campanha_id,
        c.sk_cliente,
        c.nome_cliente,
        c.telefone,
        c.status_envio
      FROM ${tables.campaignClientsTable} c
      JOIN ${tables.campaignsTable} camp
        ON camp.id = c.campanha_id
      WHERE REGEXP_REPLACE(NVL(c.telefone, ''), '[^0-9]', '') IN (:phone_full, :phone_raw)
      ORDER BY NVL(c.data_envio_zapi, camp.data_confirmacao, camp.data_criacao) DESC, c.id DESC
    )
    WHERE ROWNUM = 1
    `,
    {
      phone_full: normalizedPhone,
      phone_raw: rawPhone,
    }
  )

  return rows[0] ? normalizarLinha(rows[0]) : null
}

async function loadSellerProfile(skVendedor) {
  if (!skVendedor) return null

  const config = await loadUserProfileColumns()
  const extraColumns = [
    "nome",
    "sk_vendedor",
    config.hasFotoUrl ? "foto_url" : "CAST(NULL AS VARCHAR2(500)) AS foto_url",
    config.phoneColumn ? `${config.phoneColumn} AS telefone_contato` : "CAST(NULL AS VARCHAR2(60)) AS telefone_contato",
  ]

  const rows = await query(
    `
    SELECT ${extraColumns.join(", ")}
    FROM ${config.userTable}
    WHERE sk_vendedor = :sk_vendedor
    FETCH FIRST 1 ROWS ONLY
    `,
    { sk_vendedor: skVendedor }
  )

  if (!rows.length) return null

  const item = normalizarLinha(rows[0])
  return {
    nome: texto(item.nome),
    foto_url: texto(item.foto_url),
    telefone: telefoneWhatsapp(item.telefone_contato),
  }
}

export async function buildNegotiationCenter(token) {
  await assertAdvancedCampaignSupport()
  const tables = await getActivationTables()

  const rows = await query(
    `
    SELECT
      l.id AS link_id,
      l.token,
      l.campanha_id,
      l.campanha_cliente_id,
      l.cliente_id,
      l.vendedor_id,
      l.total_cliques,
      l.primeiro_clique,
      l.ultimo_clique,
      l.converteu,
      l.valor_conversao,
      c.nome_cliente,
      c.telefone,
      c.classificacao_rfv,
      c.mensagem_final,
      c.status_envio,
      camp.segmento,
      camp.nome_usuario_confirmacao,
      camp.data_confirmacao
    FROM ${tables.campaignLinksTable} l
    JOIN ${tables.campaignClientsTable} c
      ON c.id = l.campanha_cliente_id
    JOIN ${tables.campaignsTable} camp
      ON camp.id = l.campanha_id
    WHERE l.token = :token
    `,
    { token }
  )

  if (!rows.length) {
    return null
  }

  const item = normalizarLinha(rows[0])
  const openedAt = new Date()

  await query(
    `
    UPDATE ${tables.campaignLinksTable}
    SET total_cliques = NVL(total_cliques, 0) + 1,
        primeiro_clique = COALESCE(primeiro_clique, :momento),
        ultimo_clique = :momento
    WHERE id = :id
    `,
    {
      id: item.link_id,
      momento: openedAt,
    }
  )

  await registerCampaignEvent({
    campanhaId: item.campanha_id,
    campanhaClienteId: item.campanha_cliente_id,
    clienteId: item.cliente_id,
    tipoEvento: CAMPANHA_EVENTO.LINK_ABERTO,
    detalhe: {
      origem: "central-negociacao",
      token: item.token,
      totalCliquesAntes: numero(item.total_cliques),
    },
    dataEvento: openedAt,
  })

  const seller = await loadSellerProfile(item.vendedor_id)
  const sellerName = seller?.nome || texto(item.nome_usuario_confirmacao) || "Time SIP"
  const negotiationMessage = buildNegotiationPrompt(item.nome_cliente, sellerName)
  const mensagemPersonalizada = appendNegotiationLink(item.mensagem_final)

  return {
    token: item.token,
    campanha_id: numeroOuNull(item.campanha_id),
    campanha_cliente_id: numeroOuNull(item.campanha_cliente_id),
    cliente_id: item.cliente_id ?? null,
    cliente: {
      nome: texto(item.nome_cliente) ?? "Cliente",
      telefone: telefoneWhatsapp(item.telefone),
      classificacao_rfv: texto(item.classificacao_rfv),
      mensagem_personalizada: mensagemPersonalizada,
    },
    vendedor: {
      id: item.vendedor_id ?? null,
      nome: sellerName,
      foto_url: seller?.foto_url ?? null,
      whatsapp: seller?.telefone ?? null,
      whatsapp_link: seller?.telefone ? buildWhatsAppLink(seller.telefone, negotiationMessage) : null,
    },
    campanha: {
      segmento: texto(item.segmento),
      data_confirmacao: item.data_confirmacao ?? null,
      status_envio: texto(item.status_envio) ?? CAMPANHA_STATUS.PENDENTE,
    },
    link: {
      total_cliques: numero(item.total_cliques) + 1,
      primeiro_clique: item.primeiro_clique ?? openedAt,
      ultimo_clique: openedAt,
      converteu: String(item.converteu ?? "N").toUpperCase() === "S",
      valor_conversao: numeroOuNull(item.valor_conversao),
      url: buildNegotiationLink(item.token),
    },
    cards: buildNegotiationCards(item, item),
  }
}

export async function trackNegotiationInteraction(token, action, payload = {}) {
  await assertAdvancedCampaignSupport()
  const tables = await getActivationTables()

  const rows = await query(
    `
    SELECT
      l.id AS link_id,
      l.token,
      l.campanha_id,
      l.campanha_cliente_id,
      l.cliente_id,
      l.vendedor_id
    FROM ${tables.campaignLinksTable} l
    WHERE l.token = :token
    `,
    { token }
  )

  if (!rows.length) {
    throw new Error("Token da Central de Negociacao nao encontrado.")
  }

  const item = normalizarLinha(rows[0])
  const normalizedAction = String(action ?? "").trim().toLowerCase()
  const eventType =
    normalizedAction === "orcamento"
      ? CAMPANHA_EVENTO.ORCAMENTO_SOLICITADO
      : CAMPANHA_EVENTO.NEGOCIACAO_INICIADA

  await registerCampaignEvent({
    campanhaId: item.campanha_id,
    campanhaClienteId: item.campanha_cliente_id,
    clienteId: item.cliente_id,
    tipoEvento: eventType,
    detalhe: {
      action: normalizedAction || "desconhecido",
      ...payload,
    },
    dataEvento: new Date(),
  })

  return {
    success: true,
    action: normalizedAction,
    eventType,
  }
}

export async function refreshCampaignConversions(campanhaId) {
  await assertAdvancedCampaignSupport()
  const tables = await getActivationTables()

  const rows = await query(
    `
    WITH base AS (
      SELECT
        c.id AS campanha_cliente_id,
        c.sk_cliente,
        NVL(c.data_envio_zapi, camp.data_confirmacao) AS data_referencia
      FROM ${tables.campaignClientsTable} c
      JOIN ${tables.campaignsTable} camp
        ON camp.id = c.campanha_id
      WHERE c.campanha_id = :campanha_id
        AND c.sk_cliente IS NOT NULL
        AND NVL(c.data_envio_zapi, camp.data_confirmacao) IS NOT NULL
    )
    SELECT
      base.campanha_cliente_id,
      base.sk_cliente,
      ROUND(NVL(SUM(${signedRevenueSql("f")}), 0), 2) AS valor_conversao
    FROM base
    LEFT JOIN DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
      ON f.sk_cliente = base.sk_cliente
     AND f.sk_dt_recebimento BETWEEN TO_NUMBER(TO_CHAR(base.data_referencia, 'YYYYMMDD'))
                                 AND TO_NUMBER(TO_CHAR(base.data_referencia + 15, 'YYYYMMDD'))
    GROUP BY base.campanha_cliente_id, base.sk_cliente
    `,
    { campanha_id: campanhaId }
  )

  for (const row of rows) {
    const item = normalizarLinha(row)
    const valorConversao = numero(item.valor_conversao)
    const converteu = valorConversao > 0 ? "S" : "N"

    await query(
      `
      UPDATE ${tables.campaignLinksTable}
      SET converteu = :converteu,
          valor_conversao = :valor_conversao
      WHERE campanha_cliente_id = :campanha_cliente_id
      `,
      {
        campanha_cliente_id: item.campanha_cliente_id,
        converteu,
        valor_conversao: converteu === "S" ? valorConversao : null,
      }
    )

    if (converteu === "S") {
      const alreadyRegistered = await campaignEventExists(
        campanhaId,
        item.campanha_cliente_id,
        CAMPANHA_EVENTO.VENDA_GERADA
      )

      if (!alreadyRegistered) {
        await registerCampaignEvent({
          campanhaId,
          campanhaClienteId: item.campanha_cliente_id,
          clienteId: item.sk_cliente,
          tipoEvento: CAMPANHA_EVENTO.VENDA_GERADA,
          detalhe: {
            valor_conversao: valorConversao,
            janela_dias: 15,
          },
          dataEvento: new Date(),
        })
      }
    }
  }
}

export async function getCampaignDashboard(campanhaId) {
  await assertAdvancedCampaignSupport()
  await refreshCampaignConversions(campanhaId)
  const tables = await getActivationTables()

  const [headerRows, eventRows, linkRows, clientRows] = await Promise.all([
    query(
      `
      SELECT
        camp.id,
        camp.segmento,
        camp.template_id,
        camp.mensagem_base,
        camp.vendedor_id,
        camp.empresa_id,
        camp.data_confirmacao,
        camp.nome_usuario_confirmacao,
        camp.data_criacao,
        COUNT(cli.id) AS total_clientes,
        SUM(CASE WHEN cli.status_envio = 'PENDENTE' THEN 1 ELSE 0 END) AS pendentes,
        SUM(CASE WHEN cli.status_envio = 'FALHA' THEN 1 ELSE 0 END) AS falhas
      FROM ${tables.campaignsTable} camp
      LEFT JOIN ${tables.campaignClientsTable} cli
        ON cli.campanha_id = camp.id
      WHERE camp.id = :campanha_id
      GROUP BY
        camp.id,
        camp.segmento,
        camp.template_id,
        camp.mensagem_base,
        camp.vendedor_id,
        camp.empresa_id,
        camp.data_confirmacao,
        camp.nome_usuario_confirmacao,
        camp.data_criacao
      `,
      { campanha_id: campanhaId }
    ),
    query(
      `
      SELECT
        tipo_evento,
        COUNT(DISTINCT campanha_cliente_id) AS total
      FROM ${tables.campaignEventsTable}
      WHERE campanha_id = :campanha_id
      GROUP BY tipo_evento
      `,
      { campanha_id: campanhaId }
    ),
    query(
      `
      SELECT
        COUNT(*) AS total_links,
        SUM(CASE WHEN NVL(total_cliques, 0) > 0 THEN 1 ELSE 0 END) AS clientes_com_clique,
        NVL(SUM(total_cliques), 0) AS total_cliques,
        SUM(CASE WHEN converteu = 'S' THEN 1 ELSE 0 END) AS clientes_convertidos,
        ROUND(NVL(SUM(CASE WHEN converteu = 'S' THEN valor_conversao ELSE 0 END), 0), 2) AS receita_gerada
      FROM ${tables.campaignLinksTable}
      WHERE campanha_id = :campanha_id
      `,
      { campanha_id: campanhaId }
    ),
    query(
      `
      WITH ultimo_evento AS (
        SELECT *
        FROM (
          SELECT
            e.campanha_cliente_id,
            e.tipo_evento,
            e.data_evento,
            ROW_NUMBER() OVER (PARTITION BY e.campanha_cliente_id ORDER BY e.data_evento DESC, e.id DESC) AS rn
          FROM ${tables.campaignEventsTable} e
          WHERE e.campanha_id = :campanha_id
        )
        WHERE rn = 1
      )
      SELECT
        cli.id,
        cli.sk_cliente,
        cli.nome_cliente,
        cli.telefone,
        cli.status_envio,
        cli.message_id,
        cli.data_envio_zapi,
        cli.erro_envio,
        links.token,
        links.link_url,
        links.total_cliques,
        links.converteu,
        links.valor_conversao,
        ultimo_evento.tipo_evento AS ultimo_evento_tipo,
        ultimo_evento.data_evento AS ultimo_evento_em
      FROM ${tables.campaignClientsTable} cli
      LEFT JOIN ${tables.campaignLinksTable} links
        ON links.campanha_cliente_id = cli.id
      LEFT JOIN ultimo_evento
        ON ultimo_evento.campanha_cliente_id = cli.id
      WHERE cli.campanha_id = :campanha_id
      ORDER BY cli.nome_cliente, cli.id
      `,
      { campanha_id: campanhaId }
    ),
  ])

  if (!headerRows.length) {
    throw new Error("Campanha de ativacao nao encontrada.")
  }

  const header = normalizarLinha(headerRows[0])
  const linkMetrics = normalizarLinha(linkRows[0] ?? {})
  const eventMap = Object.fromEntries(
    eventRows.map((row) => {
      const item = normalizarLinha(row)
      return [String(item.tipo_evento ?? "").toUpperCase(), numero(item.total)]
    })
  )

  const enviados = eventMap[CAMPANHA_EVENTO.MENSAGEM_ENVIADA] ?? 0
  const entregues = eventMap[CAMPANHA_EVENTO.MENSAGEM_ENTREGUE] ?? 0
  const lidos = eventMap[CAMPANHA_EVENTO.MENSAGEM_LIDA] ?? 0
  const responderam = eventMap[CAMPANHA_EVENTO.CLIENTE_RESPONDEU] ?? 0
  const abriramLink = numero(linkMetrics.clientes_com_clique)
  const iniciaramNegociacao = eventMap[CAMPANHA_EVENTO.NEGOCIACAO_INICIADA] ?? 0
  const solicitaramOrcamento = eventMap[CAMPANHA_EVENTO.ORCAMENTO_SOLICITADO] ?? 0
  const converteram = eventMap[CAMPANHA_EVENTO.VENDA_GERADA] ?? numero(linkMetrics.clientes_convertidos)
  const receitaGerada = numero(linkMetrics.receita_gerada)

  return {
    campanha: {
      id: numeroOuNull(header.id),
      segmento: texto(header.segmento),
      template_id: numeroOuNull(header.template_id),
      mensagem_base: texto(header.mensagem_base),
      vendedor_id: numeroOuNull(header.vendedor_id),
      empresa_id: numeroOuNull(header.empresa_id),
      data_confirmacao: header.data_confirmacao ?? null,
      nome_usuario_confirmacao: texto(header.nome_usuario_confirmacao),
      data_criacao: header.data_criacao ?? null,
      total_clientes: numero(header.total_clientes),
      pendentes: numero(header.pendentes),
      falhas: numero(header.falhas),
      warning: buildCampaignWarning(numero(header.total_clientes)),
    },
    kpis: {
      enviados,
      entregues,
      lidos,
      responderam,
      abriram_link: abriramLink,
      iniciaram_negociacao: iniciaramNegociacao,
      solicitaram_orcamento: solicitaramOrcamento,
      converteram,
      receita_gerada: receitaGerada,
      pendentes: numero(header.pendentes),
      falhas: numero(header.falhas),
      total_cliques: numero(linkMetrics.total_cliques),
    },
    funil: [
      { id: "enviado", label: "Enviado", value: enviados },
      { id: "entregue", label: "Entregue", value: entregues },
      { id: "lido", label: "Lido", value: lidos },
      { id: "clicou", label: "Clicou", value: abriramLink },
      { id: "negociou", label: "Negociou", value: iniciaramNegociacao },
      { id: "comprou", label: "Comprou", value: converteram },
    ],
    clientes: clientRows.map((row) => {
      const item = normalizarLinha(row)
      return {
        id: String(item.id ?? ""),
        sk_cliente: item.sk_cliente ?? null,
        nome_cliente: texto(item.nome_cliente),
        telefone: telefoneValido(item.telefone),
        status_envio: texto(item.status_envio) ?? CAMPANHA_STATUS.PENDENTE,
        message_id: texto(item.message_id),
        data_envio_zapi: item.data_envio_zapi ?? null,
        erro_envio: texto(item.erro_envio),
        link_token: texto(item.token),
        link_url: texto(item.link_url),
        total_cliques: numero(item.total_cliques),
        converteu: String(item.converteu ?? "N").toUpperCase() === "S",
        valor_conversao: numeroOuNull(item.valor_conversao),
        ultimo_evento_tipo: texto(item.ultimo_evento_tipo),
        ultimo_evento_em: item.ultimo_evento_em ?? null,
      }
    }),
  }
}

export function buildCampaignWebhookPayload(campanhaId, campanha, clientes) {
  return {
    campanha_id: campanhaId,
    segmento: campanha?.segmento ?? null,
    vendedor_id: campanha?.vendedor_id ?? null,
    mensagem_base: campanha?.mensagem_base ?? null,
    warning: buildCampaignWarning(clientes.length),
    clientes: clientes.map((cliente) => ({
      campanha_cliente_id: cliente.campanha_cliente_id ?? null,
      cliente_id: cliente.sk_cliente ?? null,
      nome_cliente: cliente.nome_cliente,
      telefone: cliente.telefone,
      classificacao_rfv: cliente.classificacao_rfv ?? null,
      mensagem_final: cliente.mensagem_final,
      whatsapp_link: cliente.whatsapp_link,
      link_token: cliente.link_token ?? null,
      link_url: cliente.link_url ?? null,
      message_id: cliente.message_id ?? null,
    })),
  }
}

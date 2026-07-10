import { readFile } from "node:fs/promises"
import { calculateParticipantProgress } from "./desafiosProgressService.js"
import { calculateBonusSummary, calculateChallengeImpact, calculateDraftChallengeImpact } from "./desafiosImpactService.js"
import { getDesafiosDbContext, queryWithDesafiosDbContext, runWithDesafiosDbContext } from "./desafiosDbContext.js"
import {
  buildSellerInCondition,
  getAllowedSellerCodesByEmpresaId,
} from "../tenantSellerScope.js"
import { buildLojaInCondition } from "../lojaScopeService.js"

const TABLE_REQUIREMENTS = [
  {
    key: "challengesTable",
    legacyName: "DESAFIOS_COMERCIAIS",
    displayName: "DESAFIOS_COMERCIAIS",
  },
  {
    key: "challengeGoalsTable",
    legacyName: "DESAFIOS_COMERCIAIS_METAS",
    displayName: "DESAFIOS_COMERCIAIS_METAS",
  },
  {
    key: "challengeParticipantsTable",
    legacyName: "DESAFIOS_COMERCIAIS_VENDEDORES",
    displayName: "DESAFIOS_COMERCIAIS_VENDEDORES",
  },
  {
    key: "challengeProgressTable",
    legacyName: "DESAFIOS_COMERCIAIS_PROGRESSO",
    displayName: "DESAFIOS_COMERCIAIS_PROGRESSO",
  },
  {
    key: "challengeLogTable",
    legacyName: "DESAFIOS_COMERCIAIS_LOG",
    displayName: "DESAFIOS_COMERCIAIS_LOG",
  },
]

const SEQUENCES = [
  "DESAFIOS_COMERCIAIS_SEQ",
  "DESAFIOS_COMERCIAIS_METAS_SEQ",
  "DESAFIOS_COMERCIAIS_VENDEDORES_SEQ",
  "DESAFIOS_COMERCIAIS_PROGRESSO_SEQ",
  "DESAFIOS_COMERCIAIS_LOG_SEQ",
]

const metaTypes = ["FATURAMENTO", "PEDIDOS_FECHADOS", "CLIENTES_ATENDIDOS", "RECUPERAR_CLIENTES", "PRODUTO_OU_MARCA"]
const moduleSqlPath = "Back/sql/ddl_gestao_metas.sql"
const moduleSqlUrl = new URL("../../../sql/ddl_gestao_metas.sql", import.meta.url)
let challengeGoalsColumnCache = null

function numberValue(value) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function textValue(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text || null
}

function buildCatalogSearch(rawSearch) {
  const search = textValue(rawSearch)?.slice(0, 80) ?? null
  const digits = search ? search.replace(/\D/g, "") : ""
  const ready = Boolean(search) && (digits.length > 0 || search.length >= 2)

  return {
    search,
    digits: digits || null,
    ready,
    exactTerm: search ? search.toUpperCase() : null,
    likeTerm: search ? `%${search.toUpperCase()}%` : null,
    exactDigits: digits || null,
    prefixDigits: digits ? `${digits}%` : null,
    likeDigits: digits ? `%${digits}%` : null,
  }
}

function normalizeChallengeDate(dateValue, edge = "start") {
  if (!dateValue) return null

  if (dateValue instanceof Date) {
    const normalized = new Date(dateValue)
    normalized.setHours(edge === "start" ? 0 : 23, edge === "start" ? 0 : 59, edge === "start" ? 0 : 59, edge === "start" ? 0 : 999)
    return Number.isNaN(normalized.getTime()) ? null : normalized
  }

  const raw = String(dateValue).trim()
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T${edge === "start" ? "00:00:00" : "23:59:59"}`)
    : new Date(raw)

  if (Number.isNaN(parsed.getTime())) return null
  parsed.setHours(edge === "start" ? 0 : 23, edge === "start" ? 0 : 59, edge === "start" ? 0 : 59, edge === "start" ? 0 : 999)
  return parsed
}

function boolFromOracle(value) {
  return String(value ?? "").toUpperCase() === "S"
}

async function getChallengeTableNames() {
  return Object.fromEntries(TABLE_REQUIREMENTS.map((item) => [item.key, item.legacyName]))
}

async function getChallengeGoalsColumns() {
  if (challengeGoalsColumnCache) return challengeGoalsColumnCache

  const { challengeGoalsTable } = await getChallengeTableNames()
  const tableName = String(challengeGoalsTable).split(".").pop().toUpperCase()
  const rows = await query(
    `
    SELECT column_name
    FROM USER_TAB_COLUMNS
    WHERE TABLE_NAME = :table_name
    `,
    { table_name: tableName }
  )

  challengeGoalsColumnCache = new Set(
    rows.map((row) => normalizeRow(row).column_name).filter(Boolean)
  )
  return challengeGoalsColumnCache
}

async function challengeGoalsHasColumn(columnName) {
  const columns = await getChallengeGoalsColumns()
  return columns.has(String(columnName).toUpperCase())
}

async function resolveChallengeSql(sql) {
  if (typeof sql !== "string" || !sql.includes("DESAFIOS_COMERCIAIS")) {
    return sql
  }

  const resolvedNames = await getChallengeTableNames()

  return TABLE_REQUIREMENTS
    .slice()
    .sort((left, right) => right.legacyName.length - left.legacyName.length)
    .reduce((statement, item) => statement.replaceAll(item.legacyName, resolvedNames[item.key]), sql)
}

async function query(sql, params = {}, options = {}) {
  return queryWithDesafiosDbContext(await resolveChallengeSql(sql), params, options)
}

function withChallengeContext(contextOrCallback, maybeCallback) {
  if (typeof contextOrCallback === "function") {
    return runWithDesafiosDbContext(getDesafiosDbContext(), contextOrCallback)
  }

  return runWithDesafiosDbContext(
    { ...getDesafiosDbContext(), ...(contextOrCallback ?? {}) },
    maybeCallback
  )
}

function getContextEmpresaId() {
  return getDesafiosDbContext().empresaId ?? null
}

function applyContextEmpresaId(payload) {
  const empresaId = getContextEmpresaId()
  if (!empresaId) return payload

  return {
    ...payload,
    empresaId,
  }
}

function buildEmpresaFilter(alias = null) {
  const empresaId = getContextEmpresaId()
  if (!empresaId) return { clause: "", binds: {} }

  const column = alias ? `${alias}.empresa_id` : "empresa_id"
  return {
    clause: `${column} = :empresa_id`,
    binds: { empresa_id: empresaId },
  }
}

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
}

function createServiceError(code, message, status = 400, details = {}) {
  const error = new Error(message)
  error.code = code
  error.status = status
  error.details = details
  return error
}

function isAvailableParticipantStatus(status) {
  return ["DISPONIVEL", "CONVIDADO"].includes(String(status ?? "").toUpperCase())
}

function isActiveParticipantStatus(status) {
  return ["ACEITO", "EM_ANDAMENTO", "CONCLUIDO"].includes(String(status ?? "").toUpperCase())
}

function isCampaignWithAcceptance(challenge) {
  return challenge?.exigeAceite !== false
}

function isClosedChallengeStatus(status) {
  return ["ENCERRADO", "ENCERRADO_AUTOMATICO", "ENCERRADO_MANUAL", "CANCELADO"].includes(
    String(status ?? "").toUpperCase()
  )
}

async function tableExists(tableName) {
  const rows = await query(
    `
    SELECT COUNT(*) AS total
    FROM USER_TABLES
    WHERE TABLE_NAME = :table_name
    `,
    { table_name: String(tableName).toUpperCase() }
  )
  return numberValue(rows[0]?.TOTAL ?? rows[0]?.total) > 0
}

async function sequenceExists(sequenceName) {
  const rows = await query(
    `
    SELECT COUNT(*) AS total
    FROM USER_SEQUENCES
    WHERE SEQUENCE_NAME = :sequence_name
    `,
    { sequence_name: String(sequenceName).toUpperCase() }
  )
  return numberValue(rows[0]?.TOTAL ?? rows[0]?.total) > 0
}

async function inspectModuleReadiness() {
  const resolvedTables = await getChallengeTableNames()
  const [tableChecks, sequenceChecks] = await Promise.all([
    Promise.all(
      TABLE_REQUIREMENTS.map(async (table) => ({
        name: table.displayName,
        exists: await tableExists(resolvedTables[table.key]),
      }))
    ),
    Promise.all(SEQUENCES.map(async (sequenceName) => ({ name: sequenceName, exists: await sequenceExists(sequenceName) }))),
  ])

  return {
    ready: [...tableChecks, ...sequenceChecks].every((item) => item.exists),
    missingTables: tableChecks.filter((item) => !item.exists).map((item) => item.name),
    missingSequences: sequenceChecks.filter((item) => !item.exists).map((item) => item.name),
  }
}

async function ensureModuleReadyForWrite() {
  const readiness = await inspectModuleReadiness()
  if (readiness.ready) return readiness

  throw createServiceError(
    "CHALLENGES_TABLES_MISSING",
    "As tabelas do modulo de desafios ainda nao foram criadas.",
    503,
    {
      ...readiness,
      scriptPath: moduleSqlPath,
      instructions: [
        "Execute o script SQL do modulo de desafios no banco Oracle.",
        "Confirme a criacao das tabelas DESAFIOS_COMERCIAIS_* e das sequences do modulo.",
        "Recarregue a tela para habilitar a persistencia de desafios.",
      ],
    }
  )
}

async function readModuleSqlScript() {
  try {
    return await readFile(moduleSqlUrl, "utf8")
  } catch {
    return null
  }
}

async function ensureTablesReady() {
  const readiness = await inspectModuleReadiness()
  return readiness.ready
}

async function nextSequenceValue(sequenceName) {
  const rows = await query(`SELECT ${sequenceName}.NEXTVAL AS id FROM dual`)
  return numberValue(rows[0]?.ID ?? rows[0]?.id)
}

function resolveChallengeStatus(dataInicio, dataFim) {
  const now = Date.now()
  const start = normalizeChallengeDate(dataInicio, "start")?.getTime() ?? Number.NaN
  const end = normalizeChallengeDate(dataFim, "end")?.getTime() ?? Number.NaN
  if (Number.isNaN(start) || Number.isNaN(end)) return "RASCUNHO"
  if (now < start) return "AGENDADO"
  if (now > end) return "ENCERRADO"
  return "ATIVO"
}

function normalizeChallenge(row) {
  const item = normalizeRow(row)
  return {
    id: numberValue(item.id_desafio),
    empresaId: item.empresa_id ?? null,
    titulo: textValue(item.titulo),
    descricao: textValue(item.descricao),
    dataInicio: item.data_inicio ?? null,
    dataFim: item.data_fim ?? null,
    status: textValue(item.status),
    exigeAceite: boolFromOracle(item.exige_aceite),
    criadoPor: textValue(item.criado_por),
    criadoEm: item.criado_em ?? null,
    atualizadoEm: item.atualizado_em ?? null,
  }
}

function normalizeMeta(row) {
  const item = normalizeRow(row)
  let config = {}
  if (item.config_json) {
    try {
      config = JSON.parse(String(item.config_json))
    } catch {
      config = {}
    }
  }
  return {
    idMeta: numberValue(item.id_meta),
    idDesafio: numberValue(item.id_desafio),
    tipoMeta: textValue(item.tipo_meta),
    metaValor: numberValue(item.meta_valor),
    unidadeMeta: textValue(item.unidade_meta),
    recompensaValor: numberValue(item.recompensa_valor),
    metricType: textValue(item.metric_type) ?? textValue(config.metricType) ?? 'VALOR',
    ordemExibicao: numberValue(item.ordem_exibicao),
    config,
  }
}

function hasMetaTargetSelection(meta) {
  const config = meta?.config ?? {}
  return Boolean(
    textValue(config.productId)
    || textValue(config.productName)
    || textValue(config.brandId)
    || textValue(config.brandName)
    || textValue(config.targetValue)
  )
}

function extractChallengeBrandNames(metas) {
  return Array.from(
    new Set(
      (metas ?? [])
        .map((meta) => textValue(meta?.config?.brandName))
        .filter(Boolean)
        .map((brandName) => String(brandName).trim())
    )
  )
}

function normalizeParticipant(row) {
  const item = normalizeRow(row)
  return {
    id: numberValue(item.id),
    idDesafio: numberValue(item.id_desafio),
    skVendedor: item.sk_vendedor,
    nomeVendedor: textValue(item.nome_vendedor),
    statusParticipacao: textValue(item.status_participacao),
    visualizadoEm: item.visualizado_em ?? null,
    aceitoEm: item.aceito_em ?? null,
    premioTotalLiberado: numberValue(item.premio_total_liberado),
    concluidoEm: item.concluido_em ?? null,
    ultimaAtualizacao: item.ultima_atualizacao ?? null,
  }
}

function summarizeMetaProgress(metaProgress) {
  return metaProgress.map((item) => ({
    idMeta: item.idMeta,
    tipoMeta: item.tipoMeta,
    metaValor: item.metaValor,
    unidadeMeta: item.unidadeMeta,
    recompensaValor: item.recompensaValor,
    metricType: item.metricType ?? 'VALOR',
    ordemExibicao: item.ordemExibicao,
    config: item.config,
    progressoAtual: item.progress.progressoAtual,
    percentualConclusao: item.progress.percentualConclusao,
    concluidoEm: item.progress.concluidoEm,
    premioLiberado: item.progress.concluido,
    premioValor: item.progress.premioValor,
    multiplier: item.progress.multiplier ?? 0,
  }))
}

async function loadMetas(idDesafio) {
  const rows = await query(
    `
    SELECT *
    FROM DESAFIOS_COMERCIAIS_METAS
    WHERE id_desafio = :id_desafio
    ORDER BY ordem_exibicao, id_meta
    `,
    { id_desafio: idDesafio }
  )
  return rows.map(normalizeMeta)
}

async function loadParticipants(idDesafio) {
  const rows = await query(
    `
    SELECT *
    FROM DESAFIOS_COMERCIAIS_VENDEDORES
    WHERE id_desafio = :id_desafio
    ORDER BY nome_vendedor
    `,
    { id_desafio: idDesafio }
  )
  return rows.map(normalizeParticipant)
}

async function loadTimeline(idDesafio) {
  const rows = await query(
    `
    SELECT evento, descricao, data_evento
    FROM DESAFIOS_COMERCIAIS_LOG
    WHERE id_desafio = :id_desafio
    ORDER BY data_evento DESC
    `,
    { id_desafio: idDesafio }
  )
  return rows.map((row) => {
    const item = normalizeRow(row)
    return {
      evento: textValue(item.evento),
      descricao: textValue(item.descricao),
      dataEvento: item.data_evento ?? null,
    }
  })
}

async function insertChallengeMeta(idDesafio, meta, index) {
  const idMeta = await nextSequenceValue("DESAFIOS_COMERCIAIS_METAS_SEQ")
  const metricType = String(meta.metricType ?? "VALOR").toUpperCase()
  const configJson = JSON.stringify({
    ...(meta.config ?? {}),
    metricType,
  })
  const hasMetricTypeColumn = await challengeGoalsHasColumn("METRIC_TYPE")
  const columns = [
    "id_meta",
    "id_desafio",
    "tipo_meta",
    "meta_valor",
    "unidade_meta",
    "recompensa_valor",
    "ordem_exibicao",
    "config_json",
    "criado_em",
    "atualizado_em",
  ]
  const values = [
    ":id_meta",
    ":id_desafio",
    ":tipo_meta",
    ":meta_valor",
    ":unidade_meta",
    ":recompensa_valor",
    ":ordem_exibicao",
    ":config_json",
    "SYSDATE",
    "SYSDATE",
  ]
  const params = {
    id_meta: idMeta,
    id_desafio: idDesafio,
    tipo_meta: String(meta.tipoMeta).toUpperCase(),
    meta_valor: meta.metaValor,
    unidade_meta: meta.unidadeMeta ?? null,
    recompensa_valor: meta.recompensaValor ?? 0,
    ordem_exibicao: index + 1,
    config_json: configJson,
  }

  if (hasMetricTypeColumn) {
    columns.splice(6, 0, "metric_type")
    values.splice(6, 0, ":metric_type")
    params.metric_type = metricType
  }

  await query(
    `
    INSERT INTO DESAFIOS_COMERCIAIS_METAS (
      ${columns.join(",\n      ")}
    ) VALUES (
      ${values.join(",\n      ")}
    )
    `,
    params
  )
}

// Restringe o pool de vendedores-alvo as lojas que o GERENTE autenticado gerencia (getDesafiosDbContext().lojaScope,
// propagado pelo controller via getScopedLojaScope). Sem essa restricao, um gerente com acesso a apenas uma loja
// poderia criar/editar desafios mirando vendedores de lojas que nao gerencia.
function getTargetSellerLojaScope() {
  return getDesafiosDbContext().lojaScope ?? null
}

async function resolveTargetSellers(payload) {
  const contextEmpresaId = getContextEmpresaId()
  const { rankingView, rankingDayView } = await getRankingViewNames()
  const allowedSellerCodes = await getAllowedSellerCodesByEmpresaId(contextEmpresaId)
  const lojaScope = getTargetSellerLojaScope()
  const lojaCondition = buildLojaInCondition("sk_empresa", lojaScope, "desafio_target_loja")
  const explicitSellers = Array.isArray(payload.sellerIds)
    ? payload.sellerIds.map(Number).filter(Number.isFinite)
    : []

  if (explicitSellers.length) {
    const explicitAllowed = allowedSellerCodes
      ? explicitSellers.filter((sellerId) => allowedSellerCodes.has(String(sellerId)))
      : explicitSellers
    const where = [
      explicitAllowed.length ? `sk_vendedor IN (${explicitAllowed.join(",")})` : "1 = 0",
      lojaCondition.clause,
    ]
    const binds = { ...lojaCondition.binds }

    const rows = await query(
      `
      SELECT DISTINCT sk_vendedor, nome_vendedor, sk_empresa
      FROM (
        SELECT sk_vendedor, nome_vendedor, sk_empresa
        FROM ${rankingView}
        UNION ALL
        SELECT sk_vendedor, nome_vendedor, sk_empresa
        FROM ${rankingDayView}
      )
      WHERE ${where.join(" AND ")}
      `,
      binds
    )
    return rows.map((row) => normalizeRow(row)).map((row) => ({
      skVendedor: row.sk_vendedor,
      nomeVendedor: row.nome_vendedor ?? `Vendedor ${row.sk_vendedor}`,
      empresaId: row.sk_empresa ?? null,
    }))
  }

  const binds = { ...lojaCondition.binds }
  const where = [lojaCondition.clause]
  const sellerScope = buildSellerInCondition("base.sk_vendedor", allowedSellerCodes, "target_seller")
  if (allowedSellerCodes) {
    where.push(sellerScope.clause)
    Object.assign(binds, sellerScope.binds)
  }

  const rows = await query(
    `
    SELECT DISTINCT base.sk_vendedor, base.nome_vendedor, base.sk_empresa
    FROM (
      SELECT sk_vendedor, nome_vendedor, sk_empresa
      FROM ${rankingView}
      UNION ALL
      SELECT sk_vendedor, nome_vendedor, sk_empresa
      FROM ${rankingDayView}
    ) base
    WHERE ${where.join(" AND ")}
    ORDER BY base.nome_vendedor
    `,
    binds
  )
  return rows.map((row) => normalizeRow(row)).map((row) => ({
    skVendedor: row.sk_vendedor,
    nomeVendedor: row.nome_vendedor ?? `Vendedor ${row.sk_vendedor}`,
    empresaId: row.sk_empresa ?? null,
  }))
}

async function getRankingViewNames() {
  return {
    rankingView: "VW_RANKING_VENDEDORES",
    rankingDayView: "VW_RANKING_VENDEDORES_DIA",
  }
}

async function insertLog(idDesafio, evento, descricao, skVendedor = null) {
  const id = await nextSequenceValue("DESAFIOS_COMERCIAIS_LOG_SEQ")
  await query(
    `
    INSERT INTO DESAFIOS_COMERCIAIS_LOG (
      id,
      id_desafio,
      sk_vendedor,
      evento,
      descricao,
      data_evento
    ) VALUES (
      :id,
      :id_desafio,
      :sk_vendedor,
      :evento,
      :descricao,
      SYSDATE
    )
    `,
    { id, id_desafio: idDesafio, sk_vendedor: skVendedor, evento, descricao }
  )
}

async function updateProgressRows(challenge, metas, participantResult) {
  for (const metaProgress of participantResult.metas) {
    const existingRows = await query(
      `
      SELECT id
      FROM DESAFIOS_COMERCIAIS_PROGRESSO
      WHERE id_meta = :id_meta
        AND sk_vendedor = :sk_vendedor
      `,
      { id_meta: metaProgress.idMeta, sk_vendedor: participantResult.participant.skVendedor }
    )

    const progressId = existingRows.length
      ? numberValue(existingRows[0]?.ID ?? existingRows[0]?.id)
      : await nextSequenceValue("DESAFIOS_COMERCIAIS_PROGRESSO_SEQ")

    if (!existingRows.length) {
      await query(
        `
        INSERT INTO DESAFIOS_COMERCIAIS_PROGRESSO (
          id,
          id_desafio,
          id_meta,
          sk_vendedor,
          progresso_atual,
          percentual_conclusao,
          concluido_em,
          premio_liberado,
          premio_valor,
          ultima_atualizacao
        ) VALUES (
          :id,
          :id_desafio,
          :id_meta,
          :sk_vendedor,
          :progresso_atual,
          :percentual_conclusao,
          :concluido_em,
          :premio_liberado,
          :premio_valor,
          SYSDATE
        )
        `,
        {
          id: progressId,
          id_desafio: challenge.id,
          id_meta: metaProgress.idMeta,
          sk_vendedor: participantResult.participant.skVendedor,
          progresso_atual: metaProgress.progressoAtual,
          percentual_conclusao: metaProgress.percentualConclusao,
          concluido_em: metaProgress.concluidoEm,
          premio_liberado: metaProgress.premioLiberado ? "S" : "N",
          premio_valor: metaProgress.premioValor,
        }
      )
      continue
    }

    await query(
      `
      UPDATE DESAFIOS_COMERCIAIS_PROGRESSO
      SET progresso_atual = :progresso_atual,
          percentual_conclusao = :percentual_conclusao,
          concluido_em = :concluido_em,
          premio_liberado = :premio_liberado,
          premio_valor = :premio_valor,
          ultima_atualizacao = SYSDATE
      WHERE id = :id
      `,
      {
        id: progressId,
        progresso_atual: metaProgress.progressoAtual,
        percentual_conclusao: metaProgress.percentualConclusao,
        concluido_em: metaProgress.concluidoEm,
        premio_liberado: metaProgress.premioLiberado ? "S" : "N",
        premio_valor: metaProgress.premioValor,
      }
    )
  }

  await query(
    `
    UPDATE DESAFIOS_COMERCIAIS_VENDEDORES
    SET status_participacao = :status_participacao,
        premio_total_liberado = :premio_total_liberado,
        concluido_em = :concluido_em,
        ultima_atualizacao = SYSDATE
    WHERE id = :id
    `,
    {
      id: participantResult.participant.id,
      status_participacao: participantResult.participant.statusParticipacao,
      premio_total_liberado: participantResult.participant.premioTotalLiberado,
      concluido_em: participantResult.participant.concluidoEm,
    }
  )
}

function buildChallengeStats(participantsDetailed, metas) {
  const totalParticipants = participantsDetailed.length
  const acceptedParticipants = participantsDetailed.filter((item) => isActiveParticipantStatus(item.participant.statusParticipacao)).length
  const completedParticipants = participantsDetailed.filter((item) => item.participant.statusParticipacao === "CONCLUIDO").length
  const progressAverage = totalParticipants
    ? Number((participantsDetailed.reduce((sum, item) => sum + item.resumo.percentualGeral, 0) / totalParticipants).toFixed(2))
    : 0
  const rewardPerChallenge = metas.reduce((sum, meta) => sum + numberValue(meta.recompensaValor), 0)

  return {
    totalParticipants,
    acceptedParticipants,
    completedParticipants,
    pendingParticipants: totalParticipants - acceptedParticipants,
    progressAverage,
    adherenceRate: totalParticipants ? Number(((acceptedParticipants / totalParticipants) * 100).toFixed(2)) : 0,
    completionRate: totalParticipants ? Number(((completedParticipants / totalParticipants) * 100).toFixed(2)) : 0,
    estimatedRewardTotal: Number((rewardPerChallenge * totalParticipants).toFixed(2)),
  }
}

function aggregateImpactSummary(items) {
  const totals = items.reduce(
    (summary, item) => {
      summary.bonusPotential += numberValue(item?.impact?.bonusPotential)
      summary.bonusPaid += numberValue(item?.impact?.bonusPaid)
      summary.estimatedRevenue += numberValue(item?.impact?.estimatedRevenue)
      summary.realizedRevenue += numberValue(item?.impact?.realizedRevenue)
      summary.estimatedOrders += numberValue(item?.impact?.estimatedOrders)
      summary.realizedOrders += numberValue(item?.impact?.realizedOrders)
      summary.estimatedClients += numberValue(item?.impact?.estimatedClients)
      summary.realizedClients += numberValue(item?.impact?.realizedClients)
      return summary
    },
    {
      bonusPotential: 0,
      bonusPaid: 0,
      estimatedRevenue: 0,
      realizedRevenue: 0,
      estimatedOrders: 0,
      realizedOrders: 0,
      estimatedClients: 0,
      realizedClients: 0,
    }
  )

  return {
    bonusPotential: Number(totals.bonusPotential.toFixed(2)),
    bonusPaid: Number(totals.bonusPaid.toFixed(2)),
    estimatedRevenue: Number(totals.estimatedRevenue.toFixed(2)),
    realizedRevenue: Number(totals.realizedRevenue.toFixed(2)),
    estimatedOrders: Number(totals.estimatedOrders.toFixed(2)),
    realizedOrders: Number(totals.realizedOrders.toFixed(2)),
    estimatedClients: Number(totals.estimatedClients.toFixed(2)),
    realizedClients: Number(totals.realizedClients.toFixed(2)),
    returnPerBonusPotential: numberValue(totals.bonusPotential) > 0
      ? Number((totals.estimatedRevenue / totals.bonusPotential).toFixed(2))
      : 0,
    returnPerBonusRealized: numberValue(totals.bonusPaid) > 0
      ? Number((totals.realizedRevenue / totals.bonusPaid).toFixed(2))
      : 0,
  }
}

async function hydrateChallenge(challenge, { fullImpact = true } = {}) {
  const [metas, participants] = await Promise.all([
    loadMetas(challenge.id),
    loadParticipants(challenge.id),
  ])

  const participantsDetailed = await Promise.all(
    participants.map((participant) => calculateParticipantProgress(challenge, metas, participant))
  )

  const stats = buildChallengeStats(participantsDetailed, metas)
  const impact = fullImpact
    ? await calculateChallengeImpact({ metas, participantsDetailed })
    : calculateBonusSummary({ metas, participantsDetailed })
  return {
    ...challenge,
    metas,
    stats,
    impact,
    participants: participantsDetailed.map((item) => ({
      ...item.participant,
      metas: summarizeMetaProgress(item.metas),
      resumo: item.resumo,
    })),
    leaderboard: participantsDetailed
      .slice()
      .sort((a, b) => b.resumo.percentualGeral - a.resumo.percentualGeral || b.participant.premioTotalLiberado - a.participant.premioTotalLiberado)
      .slice(0, 5)
      .map((item, index) => ({
        posicao: index + 1,
        skVendedor: item.participant.skVendedor,
        nomeVendedor: item.participant.nomeVendedor,
        percentualConclusao: item.resumo.percentualGeral,
        premioTotalLiberado: item.participant.premioTotalLiberado,
      })),
  }
}

function validatePayload(payload) {
  if (!textValue(payload.titulo)) throw new Error("Titulo do desafio e obrigatorio.")
  if (!payload.dataInicio || !payload.dataFim) throw new Error("Prazo do desafio e obrigatorio.")
  if (!Array.isArray(payload.metas) || payload.metas.length === 0) throw new Error("Adicione pelo menos uma meta ao desafio.")
  for (const meta of payload.metas) {
    if (!metaTypes.includes(String(meta.tipoMeta ?? "").toUpperCase())) throw new Error("Uma das metas possui tipo invalido.")
    if (numberValue(meta.metaValor) <= 0) throw new Error("Toda meta precisa ter valor maior que zero.")
    if (String(meta.tipoMeta ?? "").toUpperCase() === "PRODUTO_OU_MARCA" && !hasMetaTargetSelection(meta)) {
      throw new Error("Meta do tipo PRODUTO_OU_MARCA exige ao menos um produto (productId) ou marca (brandId) configurado.")
    }
  }
}

export async function getChallengeModuleSetup(context = {}) {
  return withChallengeContext(context, async () => {
  const readiness = await inspectModuleReadiness()
  const sqlScript = await readModuleSqlScript()

  return {
    ready: readiness.ready,
    code: readiness.ready ? null : "CHALLENGES_TABLES_MISSING",
    error: readiness.ready ? null : "As tabelas do modulo de desafios ainda nao foram criadas.",
    missingTables: readiness.missingTables,
    missingSequences: readiness.missingSequences,
    scriptPath: moduleSqlPath,
    sqlScript,
    instructions: [
      "Execute o script SQL do modulo de desafios no banco Oracle.",
      "Valide a criacao das tabelas DESAFIOS_COMERCIAIS_*, dos indices e das sequences do modulo.",
      "Recarregue a pagina para liberar criacao, edicao e acompanhamento das campanhas.",
    ],
  }
  })
}

export async function listChallengeMetadata(context = {}) {
  return withChallengeContext(context, async () => {
  const contextEmpresaId = getContextEmpresaId()
  const { rankingView, rankingDayView } = await getRankingViewNames()
  const allowedSellerCodes = await getAllowedSellerCodesByEmpresaId(contextEmpresaId)
  const sellerScope = buildSellerInCondition("sk_vendedor", allowedSellerCodes, "metadata_seller")
  const where = allowedSellerCodes ? `WHERE ${sellerScope.clause}` : ""
  const binds = allowedSellerCodes ? sellerScope.binds : {}
  const rows = await query(
    `
    SELECT DISTINCT sk_vendedor, nome_vendedor, sk_empresa
    FROM (
      SELECT sk_vendedor, nome_vendedor, sk_empresa
      FROM ${rankingView}
      UNION ALL
      SELECT sk_vendedor, nome_vendedor, sk_empresa
      FROM ${rankingDayView}
    )
    ${where}
    ORDER BY nome_vendedor
    `,
    binds
  )

  return {
    metaTypes,
    sellers: rows.map((row) => {
      const item = normalizeRow(row)
      return {
        skVendedor: item.sk_vendedor,
        nomeVendedor: item.nome_vendedor ?? `Vendedor ${item.sk_vendedor}`,
        empresaId: item.sk_empresa ?? null,
      }
    }),
    themes: ["amber", "emerald", "electric", "royal"],
  }
  })
}

export async function searchChallengeProducts(rawSearch, context = {}) {
  return withChallengeContext(context, async () => {
  const search = buildCatalogSearch(rawSearch)
  if (!search.ready) {
    return { items: [] }
  }

  const rows = await query(
    `
    WITH produtos_base AS (
      SELECT
        p.produto_id,
        p.nome AS nome_produto,
        p.nome_marca,
        ROW_NUMBER() OVER (
          PARTITION BY p.produto_id
          ORDER BY CASE WHEN p.dt_fim_scd IS NULL THEN 0 ELSE 1 END, NVL(p.nr_versao_scd, 0) DESC
        ) AS versao_rank
      FROM DM_VENDAS.DIM_PRODUTOS p
      WHERE p.produto_id IS NOT NULL
        AND p.nome IS NOT NULL
        AND (
          UPPER(TRIM(p.nome)) LIKE :like_term
          OR TO_CHAR(p.produto_id) LIKE :like_digits
        )
    )
    SELECT produto_id, nome_produto, nome_marca
    FROM (
      SELECT
        produto_id,
        nome_produto,
        nome_marca,
        CASE
          WHEN :exact_digits IS NOT NULL AND TO_CHAR(produto_id) = :exact_digits THEN 1
          WHEN UPPER(TRIM(nome_produto)) = :exact_term THEN 2
          WHEN :prefix_digits IS NOT NULL AND TO_CHAR(produto_id) LIKE :prefix_digits THEN 3
          ELSE 4
        END AS prioridade
      FROM produtos_base
      WHERE versao_rank = 1
      ORDER BY prioridade, nome_produto
    )
    WHERE ROWNUM <= 12
    `,
    {
      exact_term: search.exactTerm,
      like_term: search.likeTerm,
      exact_digits: search.exactDigits,
      prefix_digits: search.prefixDigits,
      like_digits: search.likeDigits,
    }
  )

  return {
    items: rows.map((row) => {
      const item = normalizeRow(row)
      return {
        produtoId: item.produto_id,
        nomeProduto: textValue(item.nome_produto) ?? `Produto ${item.produto_id}`,
        nomeMarca: textValue(item.nome_marca),
      }
    }),
  }
  })
}

export async function searchChallengeBrands(rawSearch, context = {}) {
  return withChallengeContext(context, async () => {
  const search = buildCatalogSearch(rawSearch)
  if (!search.ready) {
    return { items: [] }
  }

  const rows = await query(
    `
    WITH marcas_base AS (
      SELECT
        p.marca_id,
        p.nome_marca,
        NVL(p.nome_pai_nivel1, 'Sem categoria') AS nome_categoria,
        ROW_NUMBER() OVER (
          PARTITION BY p.marca_id
          ORDER BY CASE WHEN p.dt_fim_scd IS NULL THEN 0 ELSE 1 END, NVL(p.nr_versao_scd, 0) DESC
        ) AS versao_rank
      FROM DM_VENDAS.DIM_PRODUTOS p
      WHERE p.marca_id IS NOT NULL
        AND p.nome_marca IS NOT NULL
        AND (
          UPPER(TRIM(p.nome_marca)) LIKE :like_term
          OR UPPER(TRIM(NVL(p.nome_pai_nivel1, ''))) LIKE :like_term
          OR TO_CHAR(p.marca_id) LIKE :like_digits
        )
    )
    SELECT marca_id, nome_marca, nome_categoria
    FROM (
      SELECT
        marca_id,
        nome_marca,
        nome_categoria,
        CASE
          WHEN :exact_digits IS NOT NULL AND TO_CHAR(marca_id) = :exact_digits THEN 1
          WHEN UPPER(TRIM(nome_marca)) = :exact_term THEN 2
          WHEN :prefix_digits IS NOT NULL AND TO_CHAR(marca_id) LIKE :prefix_digits THEN 3
          ELSE 4
        END AS prioridade
      FROM marcas_base
      WHERE versao_rank = 1
      ORDER BY prioridade, nome_marca
    )
    WHERE ROWNUM <= 12
    `,
    {
      exact_term: search.exactTerm,
      like_term: search.likeTerm,
      exact_digits: search.exactDigits,
      prefix_digits: search.prefixDigits,
      like_digits: search.likeDigits,
    }
  )

  return {
    items: rows.map((row) => {
      const item = normalizeRow(row)
      return {
        marcaId: item.marca_id,
        nomeMarca: textValue(item.nome_marca) ?? `Marca ${item.marca_id}`,
        nomeCategoria: textValue(item.nome_categoria),
      }
    }),
  }
  })
}

export async function previewChallengeImpact(payload, context = {}) {
  return withChallengeContext(context, async () => {
  const scopedPayload = applyContextEmpresaId(payload)
  validatePayload(scopedPayload)
  const targetSellers = await resolveTargetSellers(scopedPayload)
  const impact = await calculateDraftChallengeImpact(scopedPayload, targetSellers)

  return {
    impact,
    participantsPreview: {
      eligibleParticipants: targetSellers.length,
      companies: Array.from(new Set(targetSellers.map((seller) => String(seller.empresaId ?? "")).filter(Boolean))).length,
    },
  }
  })
}

export async function listChallenges(context = {}) {
  return withChallengeContext(context, async () => {
  const readiness = await inspectModuleReadiness()
  if (!readiness.ready) {
    return {
      items: [],
      summary: {
        activeChallenges: 0,
        totalParticipants: 0,
        estimatedRewardTotal: 0,
        adherenceRate: 0,
        completionRate: 0,
        paidRewardTotal: 0,
        estimatedRevenueTotal: 0,
        realizedRevenueTotal: 0,
        returnPerBonusPotential: 0,
        returnPerBonusRealized: 0,
      },
      initialization: {
        ready: false,
        code: "CHALLENGES_TABLES_MISSING",
        error: "As tabelas do modulo de desafios ainda nao foram criadas.",
      },
      mock: false,
    }
  }

  const empresaFilter = buildEmpresaFilter()
  const where = empresaFilter.clause ? `WHERE ${empresaFilter.clause}` : ""
  const rows = await query(
    `
    SELECT *
    FROM DESAFIOS_COMERCIAIS
    ${where}
    ORDER BY data_inicio DESC, id_desafio DESC
    `,
    empresaFilter.binds
  )

  const items = await Promise.all(
    rows.map((row) => hydrateChallenge(normalizeChallenge(row), { fullImpact: false }))
  )

  const impactSummary = aggregateImpactSummary(items)

  return {
    items,
    summary: {
      activeChallenges: items.filter((item) => item.status === "ATIVO").length,
      totalParticipants: items.reduce((sum, item) => sum + item.stats.totalParticipants, 0),
      estimatedRewardTotal: impactSummary.bonusPotential,
      adherenceRate: items.length ? Number((items.reduce((sum, item) => sum + item.stats.adherenceRate, 0) / items.length).toFixed(2)) : 0,
      completionRate: items.length ? Number((items.reduce((sum, item) => sum + item.stats.completionRate, 0) / items.length).toFixed(2)) : 0,
      paidRewardTotal: impactSummary.bonusPaid,
      estimatedRevenueTotal: impactSummary.estimatedRevenue,
      realizedRevenueTotal: impactSummary.realizedRevenue,
      estimatedOrdersTotal: impactSummary.estimatedOrders,
      realizedOrdersTotal: impactSummary.realizedOrders,
      estimatedClientsTotal: impactSummary.estimatedClients,
      realizedClientsTotal: impactSummary.realizedClients,
      returnPerBonusPotential: impactSummary.returnPerBonusPotential,
      returnPerBonusRealized: impactSummary.returnPerBonusRealized,
    },
    initialization: { ready: true, code: null, error: null },
    mock: false,
  }
  })
}

export async function getChallengeById(idDesafio, context = {}) {
  return withChallengeContext(context, async () => {
  const ready = await ensureTablesReady()
  if (!ready) {
    throw createServiceError(
      "CHALLENGES_TABLES_MISSING",
      "As tabelas do modulo de desafios ainda nao foram criadas.",
      503,
      { scriptPath: moduleSqlPath }
    )
  }

  const empresaFilter = buildEmpresaFilter()
  const extraWhere = empresaFilter.clause ? `AND ${empresaFilter.clause}` : ""
  const rows = await query(
    `
    SELECT *
    FROM DESAFIOS_COMERCIAIS
    WHERE id_desafio = :id_desafio
      ${extraWhere}
    `,
    { id_desafio: idDesafio, ...empresaFilter.binds }
  )
  if (!rows.length) throw new Error("Desafio nao encontrado.")

  const challenge = await hydrateChallenge(normalizeChallenge(rows[0]))
  return { ...challenge, timeline: await loadTimeline(idDesafio), mock: false }
  })
}

export async function createChallenge(payload, context = {}) {
  return withChallengeContext(context, async () => {
  await ensureModuleReadyForWrite()
  const scopedPayload = applyContextEmpresaId(payload)
  validatePayload(scopedPayload)
  const idDesafio = await nextSequenceValue("DESAFIOS_COMERCIAIS_SEQ")
  const targetSellers = await resolveTargetSellers(scopedPayload)

  await query(
    `
    INSERT INTO DESAFIOS_COMERCIAIS (
      id_desafio,
      empresa_id,
      titulo,
      descricao,
      data_inicio,
      data_fim,
      status,
      exige_aceite,
      criado_por,
      criado_em,
      atualizado_em
    ) VALUES (
      :id_desafio,
      :empresa_id,
      :titulo,
      :descricao,
      :data_inicio,
      :data_fim,
      :status,
      :exige_aceite,
      :criado_por,
      SYSDATE,
      SYSDATE
    )
    `,
    {
      id_desafio: idDesafio,
      empresa_id: scopedPayload.empresaId ?? null,
      titulo: scopedPayload.titulo,
      descricao: scopedPayload.descricao ?? null,
      data_inicio: normalizeChallengeDate(scopedPayload.dataInicio, "start"),
      data_fim: normalizeChallengeDate(scopedPayload.dataFim, "end"),
      status: resolveChallengeStatus(scopedPayload.dataInicio, scopedPayload.dataFim),
      exige_aceite: scopedPayload.exigeAceite === false ? "N" : "S",
      criado_por: scopedPayload.criadoPor ?? "Sistema",
    }
  )

  for (const [index, meta] of scopedPayload.metas.entries()) {
    await insertChallengeMeta(idDesafio, meta, index)
  }

  for (const seller of targetSellers) {
    const id = await nextSequenceValue("DESAFIOS_COMERCIAIS_VENDEDORES_SEQ")
    await query(
      `
      INSERT INTO DESAFIOS_COMERCIAIS_VENDEDORES (
        id,
        id_desafio,
        sk_vendedor,
        nome_vendedor,
        status_participacao,
        ultima_atualizacao
      ) VALUES (
        :id,
        :id_desafio,
        :sk_vendedor,
        :nome_vendedor,
        :status_participacao,
        SYSDATE
      )
      `,
      {
        id,
        id_desafio: idDesafio,
        sk_vendedor: seller.skVendedor,
        nome_vendedor: seller.nomeVendedor,
        status_participacao: scopedPayload.exigeAceite === false ? "CONVIDADO" : "DISPONIVEL",
      }
    )
  }

  await insertLog(idDesafio, "CRIADO", `Desafio publicado com ${scopedPayload.metas.length} meta(s).`)
  return getChallengeById(idDesafio)
  })
}

export async function updateChallenge(idDesafio, payload, context = {}) {
  return withChallengeContext(context, async () => {
  await ensureModuleReadyForWrite()
  await assertChallengeInScope(idDesafio)
  const scopedPayload = applyContextEmpresaId(payload)
  validatePayload(scopedPayload)
  const targetSellers = await resolveTargetSellers(scopedPayload)
  await query(
    `
    UPDATE DESAFIOS_COMERCIAIS
    SET empresa_id = :empresa_id,
        titulo = :titulo,
        descricao = :descricao,
        data_inicio = :data_inicio,
        data_fim = :data_fim,
        status = :status,
        exige_aceite = :exige_aceite,
        atualizado_em = SYSDATE
    WHERE id_desafio = :id_desafio
    `,
    {
      id_desafio: idDesafio,
      empresa_id: scopedPayload.empresaId ?? null,
      titulo: scopedPayload.titulo,
      descricao: scopedPayload.descricao ?? null,
      data_inicio: normalizeChallengeDate(scopedPayload.dataInicio, "start"),
      data_fim: normalizeChallengeDate(scopedPayload.dataFim, "end"),
      status: resolveChallengeStatus(scopedPayload.dataInicio, scopedPayload.dataFim),
      exige_aceite: scopedPayload.exigeAceite === false ? "N" : "S",
    }
  )

  await query(`DELETE FROM DESAFIOS_COMERCIAIS_PROGRESSO WHERE id_desafio = :id_desafio`, { id_desafio: idDesafio })
  await query(`DELETE FROM DESAFIOS_COMERCIAIS_VENDEDORES WHERE id_desafio = :id_desafio`, { id_desafio: idDesafio })
  await query(`DELETE FROM DESAFIOS_COMERCIAIS_METAS WHERE id_desafio = :id_desafio`, { id_desafio: idDesafio })
  for (const [index, meta] of scopedPayload.metas.entries()) {
    await insertChallengeMeta(idDesafio, meta, index)
  }

  for (const seller of targetSellers) {
    const id = await nextSequenceValue("DESAFIOS_COMERCIAIS_VENDEDORES_SEQ")
    await query(
      `
      INSERT INTO DESAFIOS_COMERCIAIS_VENDEDORES (
        id,
        id_desafio,
        sk_vendedor,
        nome_vendedor,
        status_participacao,
        ultima_atualizacao
      ) VALUES (
        :id,
        :id_desafio,
        :sk_vendedor,
        :nome_vendedor,
        :status_participacao,
        SYSDATE
      )
      `,
      {
        id,
        id_desafio: idDesafio,
        sk_vendedor: seller.skVendedor,
        nome_vendedor: seller.nomeVendedor,
        status_participacao: scopedPayload.exigeAceite === false ? "CONVIDADO" : "DISPONIVEL",
      }
    )
  }

  await insertLog(idDesafio, "ATUALIZADO", "Desafio reconfigurado pelo gerente.")
  return getChallengeById(idDesafio)
  })
}

export async function closeChallenge(idDesafio, status = "ENCERRADO", context = {}) {
  return withChallengeContext(context, async () => {
  await ensureModuleReadyForWrite()
  await assertChallengeInScope(idDesafio)
  await query(
    `
    UPDATE DESAFIOS_COMERCIAIS
    SET status = :status,
        atualizado_em = SYSDATE
    WHERE id_desafio = :id_desafio
    `,
    { id_desafio: idDesafio, status }
  )
  await query(
    `
    UPDATE DESAFIOS_COMERCIAIS_VENDEDORES
    SET status_participacao = CASE
      WHEN status_participacao = 'CONCLUIDO' THEN status_participacao
      ELSE 'EXPIRADO'
    END,
    ultima_atualizacao = SYSDATE
    WHERE id_desafio = :id_desafio
      AND status_participacao IN ('CONVIDADO', 'DISPONIVEL', 'ACEITO', 'EM_ANDAMENTO')
    `,
    { id_desafio: idDesafio }
  )
  await insertLog(idDesafio, "ENCERRADO", `Desafio marcado como ${status}.`)
  return getChallengeById(idDesafio)
  })
}

async function assertChallengeInScope(idDesafio) {
  const empresaFilter = buildEmpresaFilter()
  const extraWhere = empresaFilter.clause ? `AND ${empresaFilter.clause}` : ""
  const rows = await query(
    `
    SELECT id_desafio
    FROM DESAFIOS_COMERCIAIS
    WHERE id_desafio = :id_desafio
      ${extraWhere}
    `,
    { id_desafio: idDesafio, ...empresaFilter.binds }
  )

  if (!rows.length) {
    throw new Error("Desafio nao encontrado.")
  }
}

async function markViewed(idDesafio, skVendedor) {
  await query(
    `
    UPDATE DESAFIOS_COMERCIAIS_VENDEDORES
    SET visualizado_em = NVL(visualizado_em, SYSDATE),
        ultima_atualizacao = SYSDATE
    WHERE id_desafio = :id_desafio
      AND sk_vendedor = :sk_vendedor
    `,
    { id_desafio: idDesafio, sk_vendedor: skVendedor }
  )
}

async function buildSellerChallengeDetail(idDesafio, skVendedor) {
  const detail = await getChallengeById(idDesafio)
  const participant = detail.participants?.find((item) => String(item.skVendedor) === String(skVendedor))
  if (!participant) throw new Error("Desafio nao encontrado para este vendedor.")

  const metaTypes = new Set((detail.metas ?? []).map((meta) => String(meta.tipoMeta ?? "").toUpperCase()))
  const sellerId = encodeURIComponent(String(skVendedor))
  const ctas = []

  if (metaTypes.has("PRODUTO_OU_MARCA") || metaTypes.has("FATURAMENTO") || metaTypes.has("PEDIDOS_FECHADOS")) {
    ctas.push({ label: "Área de Ataque", href: `/area-ataque?sk_vendedor=${sellerId}` })
  }

  if (metaTypes.has("RECUPERAR_CLIENTES") || metaTypes.has("CLIENTES_ATENDIDOS")) {
    const segment = metaTypes.has("RECUPERAR_CLIENTES") ? "&segmento=hibernando" : ""
    ctas.push({ label: "Ver clientes", href: `/ativacao-clientes?sk_vendedor=${sellerId}${segment}` })
  }

  if (!ctas.length) {
    ctas.push({ label: "Área de Ataque", href: `/area-ataque?sk_vendedor=${sellerId}` })
  }

  return {
    ...detail,
    participant,
    ctas,
  }
}

export async function markChallengeSeen(idDesafio, skVendedor, context = {}) {
  return withChallengeContext(context, async () => {
  const ready = await ensureTablesReady()
  if (!ready) {
    throw createServiceError(
      "CHALLENGES_TABLES_MISSING",
      "As tabelas do modulo de desafios ainda nao foram criadas.",
      503,
      { scriptPath: moduleSqlPath }
    )
  }

  await assertChallengeInScope(idDesafio)
  await markViewed(idDesafio, skVendedor)
  return {
    success: true,
    id: numberValue(idDesafio),
    visualizadoEm: new Date().toISOString(),
  }
  })
}

export async function acceptChallenge(idDesafio, skVendedor, context = {}) {
  return withChallengeContext(context, async () => {
  const detail = await getChallengeById(idDesafio)
  if (isClosedChallengeStatus(detail.status)) throw new Error("Nao e possivel aceitar um desafio encerrado.")
  if (!isCampaignWithAcceptance(detail)) throw new Error("Bonus mensal nao precisa de aceite.")

  const currentParticipant = detail.participants?.find((item) => String(item.skVendedor) === String(skVendedor))
  if (!currentParticipant) throw new Error("Desafio nao encontrado para este vendedor.")
  if (!isAvailableParticipantStatus(currentParticipant.statusParticipacao)) {
    throw new Error("Este desafio nao esta mais disponivel para aceite.")
  }

  await query(
    `
    UPDATE DESAFIOS_COMERCIAIS_VENDEDORES
    SET status_participacao = 'ACEITO',
        visualizado_em = NVL(visualizado_em, SYSDATE),
        aceito_em = SYSDATE,
        ultima_atualizacao = SYSDATE
    WHERE id_desafio = :id_desafio
      AND sk_vendedor = :sk_vendedor
    `,
    { id_desafio: idDesafio, sk_vendedor: skVendedor }
  )
  await insertLog(idDesafio, "ACEITO", "Desafio aceito pelo vendedor.", skVendedor)
  return buildSellerChallengeDetail(idDesafio, skVendedor)
  })
}

export async function declineChallenge(idDesafio, skVendedor, context = {}) {
  return withChallengeContext(context, async () => {
  const detail = await getChallengeById(idDesafio)
  if (isClosedChallengeStatus(detail.status)) throw new Error("Nao e possivel recusar um desafio encerrado.")
  if (!isCampaignWithAcceptance(detail)) throw new Error("Bonus mensal nao precisa de aceite.")

  const currentParticipant = detail.participants?.find((item) => String(item.skVendedor) === String(skVendedor))
  if (!currentParticipant) throw new Error("Desafio nao encontrado para este vendedor.")
  if (!isAvailableParticipantStatus(currentParticipant.statusParticipacao)) {
    throw new Error("Este desafio nao esta mais disponivel para recusa.")
  }

  await query(
    `
    UPDATE DESAFIOS_COMERCIAIS_VENDEDORES
    SET status_participacao = 'RECUSADO',
        visualizado_em = NVL(visualizado_em, SYSDATE),
        ultima_atualizacao = SYSDATE
    WHERE id_desafio = :id_desafio
      AND sk_vendedor = :sk_vendedor
      AND status_participacao IN ('DISPONIVEL', 'CONVIDADO')
    `,
    { id_desafio: idDesafio, sk_vendedor: skVendedor }
  )

  await insertLog(idDesafio, "RECUSADO", "Desafio recusado pelo vendedor.", skVendedor)
  return buildSellerChallengeDetail(idDesafio, skVendedor)
  })
}

export async function refreshChallengeProgress(idDesafio, sellerFilter = null, context = {}) {
  return withChallengeContext(context, async () => {
  const ready = await ensureTablesReady()
  if (!ready) {
    throw createServiceError(
      "CHALLENGES_TABLES_MISSING",
      "As tabelas do modulo de desafios ainda nao foram criadas.",
      503,
      { scriptPath: moduleSqlPath }
    )
  }

  const empresaFilter = buildEmpresaFilter()
  const extraWhere = empresaFilter.clause ? `AND ${empresaFilter.clause}` : ""
  const challengeRows = await query(
    `
    SELECT *
    FROM DESAFIOS_COMERCIAIS
    WHERE id_desafio = :id_desafio
      ${extraWhere}
    `,
    { id_desafio: idDesafio, ...empresaFilter.binds }
  )
  if (!challengeRows.length) throw new Error("Desafio nao encontrado.")

  const challenge = normalizeChallenge(challengeRows[0])
  const metas = await loadMetas(idDesafio)
  const participants = await loadParticipants(idDesafio)
  const filteredParticipants = sellerFilter
    ? participants.filter((item) => String(item.skVendedor) === String(sellerFilter))
    : participants

  const details = await Promise.all(
    filteredParticipants.map(async (participant) => {
      const result = await calculateParticipantProgress(challenge, metas, participant)
      await updateProgressRows(challenge, metas, result)
      return {
        ...result.participant,
        metas: summarizeMetaProgress(result.metas),
        resumo: result.resumo,
      }
    })
  )

  const refreshed = await getChallengeById(idDesafio)
  return { challenge: refreshed, participants: sellerFilter ? details : refreshed.participants, mock: false }
  })
}

export async function getChallengeParticipants(idDesafio, context = {}) {
  return withChallengeContext(context, async () => {
  const refreshed = await refreshChallengeProgress(idDesafio)
  return {
    challenge: {
      id: refreshed.challenge.id,
      titulo: refreshed.challenge.titulo,
      status: refreshed.challenge.status,
    },
    participants: refreshed.challenge.participants,
    stats: refreshed.challenge.stats,
  }
  })
}

export async function listSellerChallenges(skVendedor, mode = "all", context = {}) {
  return withChallengeContext(context, async () => {
  const readiness = await inspectModuleReadiness()
  if (!readiness.ready) {
    return {
      items: [],
      summary: { activeChallenges: 0, completedChallenges: 0, totalRewards: 0, newChallenges: 0 },
      mock: false,
    }
  }

  const empresaFilter = buildEmpresaFilter("d")
  const extraWhere = empresaFilter.clause ? `AND ${empresaFilter.clause}` : ""
  const rows = await query(
    `
    SELECT d.*
    FROM DESAFIOS_COMERCIAIS d
    JOIN DESAFIOS_COMERCIAIS_VENDEDORES v
      ON v.id_desafio = d.id_desafio
    WHERE v.sk_vendedor = :sk_vendedor
      ${extraWhere}
    ORDER BY d.data_inicio DESC, d.id_desafio DESC
    `,
    { sk_vendedor: skVendedor, ...empresaFilter.binds }
  )

  const items = await Promise.all(
    rows.map((row) => buildSellerChallengeDetail(row.ID_DESAFIO ?? row.id_desafio, skVendedor))
  )

  const filteredItems = items.filter((item) => {
    if (mode === "novos") {
      return isCampaignWithAcceptance(item) && !item.participant?.visualizadoEm && isAvailableParticipantStatus(item.participant?.statusParticipacao)
    }
    if (mode === "disponiveis") {
      return isCampaignWithAcceptance(item) && isAvailableParticipantStatus(item.participant?.statusParticipacao)
    }
    if (mode === "ativos") {
      return isCampaignWithAcceptance(item) && isActiveParticipantStatus(item.participant?.statusParticipacao)
    }
    return true
  })

  return {
    items: filteredItems,
    summary: {
      activeChallenges: filteredItems.filter((item) => ["ATIVO", "AGENDADO"].includes(item.status)).length,
      completedChallenges: filteredItems.filter((item) => item.participant?.statusParticipacao === "CONCLUIDO").length,
      totalRewards: filteredItems.reduce((sum, item) => sum + numberValue(item.participant?.premioTotalLiberado), 0),
      newChallenges: filteredItems.filter((item) => !item.participant?.visualizadoEm).length,
    },
    mock: false,
  }
  })
}

export async function getSellerChallengeAlert(skVendedor, context = {}) {
  return withChallengeContext(context, async () => {
  const readiness = await inspectModuleReadiness()
  if (!readiness.ready) {
    return {
      hasNewChallenge: false,
      challenge: null,
      items: [],
      mock: false,
    }
  }

  const empresaFilter = buildEmpresaFilter("d")
  const extraWhere = empresaFilter.clause ? `AND ${empresaFilter.clause}` : ""
  const rows = await query(
    `
    SELECT d.id_desafio,
           d.titulo,
           d.descricao,
           d.data_inicio,
           d.data_fim,
           d.status,
           d.exige_aceite,
           v.status_participacao
    FROM DESAFIOS_COMERCIAIS d
    JOIN DESAFIOS_COMERCIAIS_VENDEDORES v
      ON v.id_desafio = d.id_desafio
    WHERE v.sk_vendedor = :sk_vendedor
      ${extraWhere}
      AND d.status IN ('ATIVO', 'AGENDADO')
      AND v.status_participacao <> 'RECUSADO'
    ORDER BY d.data_inicio DESC, d.id_desafio DESC
    `,
    { sk_vendedor: skVendedor, ...empresaFilter.binds }
  )

  if (!rows.length) {
    return {
      hasNewChallenge: false,
      challenge: null,
      items: [],
      mock: false,
    }
  }

  const items = []
  for (const item of rows) {
    const row = normalizeRow(item)
    const challengeId = numberValue(row.id_desafio)
    const metas = challengeId ? await loadMetas(challengeId) : []

    items.push({
      id: challengeId,
      titulo: textValue(row.titulo),
      descricao: textValue(row.descricao),
      dataInicio: row.data_inicio ?? null,
      dataFim: row.data_fim ?? null,
      brandNames: extractChallengeBrandNames(metas),
      metas,
      exigeAceite: boolFromOracle(row.exige_aceite),
      status: textValue(row.status),
      participantStatus: textValue(row.status_participacao),
    })
  }

  return {
    hasNewChallenge: true,
    challenge: items[0] ?? null,
    items,
    mock: false,
  }
  })
}

export async function getSellerChallengeById(idDesafio, skVendedor, context = {}) {
  return withChallengeContext(context, async () => {
  await assertChallengeInScope(idDesafio)
  await markViewed(idDesafio, skVendedor)
  return buildSellerChallengeDetail(idDesafio, skVendedor)
  })
}

import { AsyncLocalStorage } from "node:async_hooks"
import { queryOracleByEmpresaId } from "../db/oracle-tenants.js"
import { findAuthUserBySkVendedor } from "./authUsersService.js"
import { resolverEscopoVendedor } from "./vendedorScopeService.js"
import { buildLojaInCondition, resolveLojaColumnName } from "./lojaScopeService.js"

const OBJECTIVE_TABLE = "OBJETIVOS_VENDEDOR"
const OBJECTIVE_SEQUENCE = "OBJETIVOS_VENDEDOR_SEQ"
const OBJECTIVE_SCRIPT_PATH = "Back/sql/ddl_gestao_metas.sql"
const OBJECTIVE_UPGRADE_SCRIPT_PATH = "Back/sql/ddl_gestao_metas.sql"
const PROFILE_TABLE = "PERFIL_VENDEDOR"
const PROFILE_SEQUENCE = "PERFIL_VENDEDOR_SEQ"
const PROFILE_SCRIPT_PATH = "Back/sql/ddl_gestao_metas.sql"
const DEFAULT_COMMISSION_RATE = 0.03
const CHALLENGES_TABLE = "desafios_comerciais"
const CHALLENGE_PROGRESS_TABLE = "desafios_comerciais_progresso"
const ORACLE_UNIQUE_VIOLATION = 1
const ORACLE_TABLE_NOT_FOUND = 942
const ORACLE_INVALID_IDENTIFIER = 904
const CURRENCY_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})
const DAY_IN_MS = 24 * 60 * 60 * 1000
let cachedProfileIncomeBreakdownSupport = null
const objetivoDbContext = new AsyncLocalStorage()

function getEmpresaIdFromPayload(payload = {}) {
  return payload?.empresa_id ?? payload?.empresaId ?? null
}

function requireEmpresaId(payload = {}, action = "executar esta operacao") {
  const empresaId = getEmpresaIdFromPayload(payload)
  if (!empresaId) {
    throw createServiceError("COMPANY_REQUIRED", `empresa_id e obrigatorio para ${action}.`, 400)
  }
  return empresaId
}

function withObjetivoDbContext(empresaId, callback) {
  return objetivoDbContext.run({ empresaId }, callback)
}

function query(sql, binds = {}, options = {}) {
  const empresaId = objetivoDbContext.getStore()?.empresaId
  if (!empresaId) {
    throw createServiceError("COMPANY_REQUIRED", "Contexto Oracle da organizacao ausente.", 400)
  }
  return queryOracleByEmpresaId(empresaId, sql, binds, options)
}

async function getObjectivesTableName() {
  return OBJECTIVE_TABLE
}

async function getProfileTableName() {
  return PROFILE_TABLE
}

async function getRankingVendorsViewName() {
  return "VW_RANKING_VENDEDORES"
}

function numberValue(value) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function optionalNumberValue(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null
  }

  const parsed = Number(String(value).replace(",", "."))
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null
}

function textValue(value) {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim()
  return normalized || null
}

function normalizeComparisonText(value) {
  return String(value ?? "").trim().toUpperCase()
}

function roundCurrency(value) {
  return Number(numberValue(value).toFixed(2))
}

function normalizeRow(row) {
  return Object.fromEntries(
    Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value])
  )
}

function createServiceError(code, message, status = 400, details = {}) {
  const error = new Error(message)
  error.code = code
  error.status = status
  error.details = details
  return error
}

function formatCurrencyBRL(value) {
  return CURRENCY_FORMATTER.format(numberValue(value))
}

function getOracleErrorCode(error) {
  if (typeof error?.errorNum === "number") {
    return error.errorNum
  }

  const match = String(error?.message ?? "").match(/ORA-(\d{5})/)
  return match ? Number(match[1]) : null
}

function parseGoalDate(value, edge = "end") {
  if (!value) return null

  const date = value instanceof Date ? new Date(value) : new Date(String(value))
  if (Number.isNaN(date.getTime())) return null

  date.setHours(
    edge === "start" ? 0 : 23,
    edge === "start" ? 0 : 59,
    edge === "start" ? 0 : 59,
    edge === "start" ? 0 : 999
  )

  return date
}

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function firstDayOfCurrentMonth() {
  const today = startOfToday()
  return new Date(today.getFullYear(), today.getMonth(), 1)
}

function endOfCurrentMonth() {
  const today = startOfToday()
  return new Date(today.getFullYear(), today.getMonth() + 1, 0)
}

function startOfDate(date) {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized
}

function daysUntilInclusive(targetDate) {
  const end = parseGoalDate(targetDate, "end")
  if (!end) return 0

  const start = startOfToday()
  const diff = startOfDate(end).getTime() - start.getTime()
  if (diff < 0) return 0

  return Math.floor(diff / DAY_IN_MS) + 1
}

function buildStatus(goalValue, earnedValue, deadline) {
  if (!goalValue) return "SEM_OBJETIVO"
  if (earnedValue >= goalValue) return "CONQUISTADA"
  if (!deadline) return "EM_ANDAMENTO"
  if (daysUntilInclusive(deadline) === 0 && startOfDate(deadline).getTime() < startOfToday().getTime()) {
    return "PRAZO_ENCERRADO"
  }
  return "EM_ANDAMENTO"
}

function normalizeObjective(row) {
  const item = normalizeRow(row)
  return {
    id: numberValue(item.id_objetivo),
    empresaId: item.empresa_id ?? null,
    vendedorId: item.vendedor_id ?? null,
    skVendedor: item.sk_vendedor ?? null,
    nomeObjetivo: textValue(item.nome_objetivo),
    valorObjetivo: roundCurrency(item.valor_objetivo),
    dataLimite: item.data_limite ?? null,
    ativo: String(item.ativo ?? "S").toUpperCase() === "S",
    criadoEm: item.criado_em ?? null,
    atualizadoEm: item.atualizado_em ?? null,
  }
}

function normalizeProfile(row) {
  const item = normalizeRow(row)
  const salarioFixo = optionalNumberValue(item.salario_fixo)
  const comissaoDesejada = optionalNumberValue(item.comissao_desejada)
  const rendaDesejadaBase = optionalNumberValue(item.renda_desejada)
  const rendaDesejada =
    rendaDesejadaBase ??
    (salarioFixo !== null || comissaoDesejada !== null
      ? roundCurrency(numberValue(salarioFixo) + numberValue(comissaoDesejada))
      : null)

  return {
    id: numberValue(item.id),
    empresaId: item.empresa_id ?? null,
    vendedorId: item.vendedor_id ?? null,
    rendaDesejada,
    salarioFixo,
    comissaoDesejada,
    motivoTrabalho: textValue(item.motivo_trabalho),
    paraQuemTrabalha: textValue(item.para_quem_trabalha),
    objetivosPessoais: textValue(item.objetivos_pessoais),
    preferenciasProduto: textValue(item.preferencias_produto),
    criadoEm: item.criado_em ?? null,
  }
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

async function tableHasColumns(tableName, columnNames) {
  if (!columnNames.length) {
    return true
  }

  const normalizedColumns = columnNames.map((columnName) => `'${String(columnName).toUpperCase()}'`).join(", ")
  const rows = await query(
    `
    SELECT COUNT(*) AS total
    FROM USER_TAB_COLUMNS
    WHERE TABLE_NAME = :table_name
      AND COLUMN_NAME IN (${normalizedColumns})
    `,
    { table_name: String(tableName).toUpperCase() }
  )

  return numberValue(rows[0]?.TOTAL ?? rows[0]?.total) >= columnNames.length
}

async function profileIncomeBreakdownReady() {
  if (cachedProfileIncomeBreakdownSupport !== null) {
    return cachedProfileIncomeBreakdownSupport
  }

  cachedProfileIncomeBreakdownSupport = await tableHasColumns(
    await getProfileTableName(),
    ["SALARIO_FIXO", "COMISSAO_DESEJADA"]
  )
  return cachedProfileIncomeBreakdownSupport
}

async function ensureObjectiveModuleReady() {
  const objectiveTableName = await getObjectivesTableName()
  const [tableReady, sequenceReady] = await Promise.all([
    tableExists(objectiveTableName),
    sequenceExists(OBJECTIVE_SEQUENCE),
  ])

  if (tableReady && sequenceReady) {
    return
  }

  throw createServiceError(
    "OBJECTIVE_TABLES_MISSING",
    "A estrutura do modulo Minha Meta de Vida ainda nao foi criada no Oracle.",
    503,
    {
      missingTables: tableReady ? [] : [OBJECTIVE_TABLE],
      missingSequences: sequenceReady ? [] : [OBJECTIVE_SEQUENCE],
      scriptPath: OBJECTIVE_SCRIPT_PATH,
      instructions: [
        "Execute o script SQL do modulo Minha Meta de Vida no banco Oracle.",
        "Confirme a criacao da tabela OBJETIVOS_VENDEDOR e da sequence OBJETIVOS_VENDEDOR_SEQ.",
      ],
    }
  )
}

async function ensureProfileModuleReady() {
  const profileTableName = await getProfileTableName()
  const [tableReady, sequenceReady] = await Promise.all([
    tableExists(profileTableName),
    sequenceExists(PROFILE_SEQUENCE),
  ])

  if (tableReady && sequenceReady) {
    return
  }

  throw createServiceError(
    "PROFILE_TABLES_MISSING",
    "A estrutura do perfil do vendedor ainda nao foi criada no Oracle.",
    503,
    {
      missingTables: tableReady ? [] : [PROFILE_TABLE],
      missingSequences: sequenceReady ? [] : [PROFILE_SEQUENCE],
      scriptPath: PROFILE_SCRIPT_PATH,
      instructions: [
        "Execute o script SQL do perfil do vendedor no banco Oracle.",
        "Confirme a criacao da tabela PERFIL_VENDEDOR e da sequence PERFIL_VENDEDOR_SEQ.",
      ],
    }
  )
}

async function isProfileModuleReady() {
  const profileTableName = await getProfileTableName()
  const [tableReady, sequenceReady] = await Promise.all([
    tableExists(profileTableName),
    sequenceExists(PROFILE_SEQUENCE),
  ])

  return tableReady && sequenceReady
}

async function nextSequenceValue(sequenceName) {
  const rows = await query(`SELECT ${sequenceName}.NEXTVAL AS id FROM dual`)
  return numberValue(rows[0]?.ID ?? rows[0]?.id)
}

async function loadSellerUser(skVendedor, empresaId = null) {
  if (!skVendedor) return null

  return findAuthUserBySkVendedor(skVendedor, empresaId)
}

async function resolveSellerContext(vendorCode, fallback = {}) {
  const fallbackEmpresaId = fallback.empresa_id ?? fallback.empresaId ?? null
  if (!fallbackEmpresaId) {
    throw createServiceError("COMPANY_REQUIRED", "empresa_id e obrigatorio para resolver o vendedor.", 400)
  }

  const scope = await resolverEscopoVendedor(vendorCode, fallbackEmpresaId)
  const user = await loadSellerUser(scope.skVendedor ?? fallback.sk_vendedor ?? null, fallbackEmpresaId)

  return {
    codigoRecebido: vendorCode,
    skVendedor: scope.skVendedor ?? fallback.sk_vendedor ?? fallback.skVendedor ?? null,
    vendedorId: scope.vendedorId ?? fallback.vendedor_id ?? fallback.vendedorId ?? null,
    nomeVendedor: scope.nomeVendedor ?? user?.nome ?? fallback.nome_vendedor ?? null,
    empresaId:
      fallback.empresa_id ??
      fallback.empresaId ??
      user?.empresa_id ??
      null,
    // Escopo de loja do vendedor logado (VENDEDOR/GERENTE); null quando o papel/tenant
    // esta fora do escopo desta feature - nesse caso as queries abaixo ficam sem filtro de loja.
    lojaScope: fallback.loja_scope ?? fallback.lojaScope ?? null,
  }
}

async function loadObjectivesBySeller({ skVendedor, vendedorId, empresaId }) {
  const objectiveTable = await getObjectivesTableName()
  const rows = await query(
    `
    SELECT *
    FROM ${objectiveTable}
    WHERE ativo = 'S'
      AND (
        (:sk_vendedor IS NOT NULL AND sk_vendedor = :sk_vendedor)
        OR vendedor_id = :vendedor_id
      )
      AND (:empresa_id IS NULL OR empresa_id = :empresa_id)
    ORDER BY data_limite ASC, atualizado_em DESC, id_objetivo DESC
    `,
    {
      sk_vendedor: skVendedor ?? null,
      vendedor_id: vendedorId,
      empresa_id: empresaId ?? null,
    }
  )

  return rows.map(normalizeObjective)
}

async function loadObjectiveById(idObjetivo) {
  const objectiveTable = await getObjectivesTableName()
  const rows = await query(
    `
    SELECT *
    FROM ${objectiveTable}
    WHERE id_objetivo = :id_objetivo
    FETCH FIRST 1 ROWS ONLY
    `,
    { id_objetivo: idObjetivo }
  )

  return rows[0] ? normalizeObjective(rows[0]) : null
}

async function loadProfileBySeller({ vendedorId, empresaId }) {
  const profileTable = await getProfileTableName()
  const rows = await query(
    `
    SELECT *
    FROM ${profileTable}
    WHERE vendedor_id = :vendedor_id
      AND (:empresa_id IS NULL OR empresa_id = :empresa_id)
    ORDER BY criado_em DESC, id DESC
    FETCH FIRST 1 ROWS ONLY
    `,
    {
      vendedor_id: vendedorId,
      empresa_id: empresaId ?? null,
    }
  )

  return rows[0] ? normalizeProfile(rows[0]) : null
}

async function loadProfileById(idPerfil) {
  const profileTable = await getProfileTableName()
  const rows = await query(
    `
    SELECT *
    FROM ${profileTable}
    WHERE id = :id
    FETCH FIRST 1 ROWS ONLY
    `,
    { id: idPerfil }
  )

  return rows[0] ? normalizeProfile(rows[0]) : null
}

async function calculateSalesRevenue(skVendedor, trackingStartDate, empresaId, lojaScope) {
  if (!skVendedor) {
    return 0
  }

  const rankingView = await getRankingVendorsViewName()
  const rankingLojaColumn = await resolveLojaColumnName(empresaId, rankingView)
  const rankingLojaCondition = buildLojaInCondition(rankingLojaColumn, lojaScope, "meta_vida_ranking_loja")
  const monthlyRows = await query(
    `
    SELECT receita_mes
    FROM ${rankingView}
    WHERE sk_vendedor = :sk_vendedor
      AND ${rankingLojaCondition.clause}
    FETCH FIRST 1 ROWS ONLY
    `,
    { sk_vendedor: skVendedor, ...rankingLojaCondition.binds }
  )

  if (monthlyRows.length) {
    return roundCurrency(monthlyRows[0]?.RECEITA_MES ?? monthlyRows[0]?.receita_mes)
  }

  if (!trackingStartDate) {
    return 0
  }

  const vendasLojaColumn = await resolveLojaColumnName(empresaId, "FATO_VENDAS_LUCRATIVIDADE")
  const vendasLojaCondition = buildLojaInCondition(vendasLojaColumn, lojaScope, "meta_vida_venda_loja")
  const rows = await query(
    `
    WITH base AS (
      SELECT
        CASE
          WHEN tipo = 'DEV' THEN NVL(valor_liquido_item, 0) * -1
          ELSE NVL(valor_liquido_item, 0)
        END AS valor_receita
      FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE
      WHERE sk_vendedor = :sk_vendedor
        AND sk_dt_fechamento >= TO_NUMBER(TO_CHAR(TRUNC(:data_inicio), 'YYYYMMDD'))
        AND ${vendasLojaCondition.clause}
    )
    SELECT ROUND(NVL(SUM(valor_receita), 0), 2) AS faturamento_total
    FROM base
    `,
    {
      sk_vendedor: skVendedor,
      data_inicio: trackingStartDate,
      ...vendasLojaCondition.binds,
    }
  )

  return roundCurrency(rows[0]?.FATURAMENTO_TOTAL ?? rows[0]?.faturamento_total)
}

function normalizeCommissionRate(value) {
  const parsed = optionalNumberValue(value)
  if (parsed === null || parsed <= 0) {
    return null
  }

  const rate = parsed > 1 ? parsed / 100 : parsed
  return Number(rate.toFixed(4))
}

async function loadCommissionSnapshotFromOracle({ skVendedor, vendedorId }) {
  if (!skVendedor && !vendedorId) {
    return null
  }

  const sql = `
    SELECT
      vendedor.sk_vendedor AS sk_vendedor,
      vendedor.vendedor_id AS vendedor_id,
      com.vendas_liquidas AS receita_ate_ontem,
      com.percentual_comissao AS percentual_comissao,
      com.valor_comissao_a_pagar AS valor_comissao_a_pagar
    FROM ft_comissao_parametrizada com
    LEFT JOIN dim_vendedor vendedor
      ON vendedor.sk_vendedor = com.sk_vendedor
    LEFT JOIN dim_empresas emp
      ON emp.sk_empresas = com.sk_empresas
    WHERE com.sk_vendedor <> -1
      AND (
        (:sk_vendedor IS NOT NULL AND vendedor.sk_vendedor = :sk_vendedor)
        OR (:vendedor_id IS NOT NULL AND vendedor.vendedor_id = :vendedor_id)
      )
    FETCH FIRST 1 ROWS ONLY
  `
  const binds = {
    sk_vendedor: skVendedor ?? null,
    vendedor_id: vendedorId ?? null,
  }

  try {
    const rows = await query(sql, binds)
    if (!Array.isArray(rows) || !rows.length) {
      return null
    }

    const item = normalizeRow(rows[0])
    return {
      salesRevenue: roundCurrency(item.receita_ate_ontem),
      commissionAmount: roundCurrency(item.valor_comissao_a_pagar),
      commissionRate: normalizeCommissionRate(item.percentual_comissao) ?? DEFAULT_COMMISSION_RATE,
      source: "oracle",
    }
  } catch (error) {
    console.warn("Nao foi possivel carregar a comissao no Oracle da Meta de Vida. Mantendo fallback estimado.", error)
    return null
  }
}

async function resolveCommissionSnapshot(seller, trackingStartDate) {
  // NOTA: ft_comissao_parametrizada/dim_vendedor/dim_empresas (Meta de Vida propriamente dita)
  // ainda nao tem o schema de loja confirmado - TODO: aplicar filtro de loja aqui quando
  // o schema dessas tabelas for verificado. Por ora fica sem filtro.
  const oracleSnapshot = await loadCommissionSnapshotFromOracle(seller)
  if (oracleSnapshot) {
    return oracleSnapshot
  }

  const salesRevenue = await calculateSalesRevenue(seller.skVendedor, trackingStartDate, seller.empresaId, seller.lojaScope)
  return {
    salesRevenue,
    commissionAmount: 0,
    commissionRate: DEFAULT_COMMISSION_RATE,
    source: "indisponivel",
  }
}

async function calculateChallengeRewards(skVendedor, trackingStartDate, empresaId) {
  if (!skVendedor || !trackingStartDate) {
    return {
      bonus: 0,
      desafios: 0,
      challengesEnabled: false,
    }
  }

  const rows = await query(
    `
    SELECT
      ROUND(
        NVL(SUM(CASE WHEN d.exige_aceite = 'N' THEN NVL(p.premio_valor, 0) ELSE 0 END), 0),
        2
      ) AS bonus_total,
      ROUND(
        NVL(SUM(CASE WHEN d.exige_aceite = 'S' THEN NVL(p.premio_valor, 0) ELSE 0 END), 0),
        2
      ) AS desafios_total
    FROM ${CHALLENGE_PROGRESS_TABLE} p
    JOIN ${CHALLENGES_TABLE} d
      ON d.id_desafio = p.id_desafio
    WHERE p.sk_vendedor = :sk_vendedor
      AND p.premio_liberado = 'S'
      AND p.concluido_em IS NOT NULL
      AND p.concluido_em >= TRUNC(:data_inicio)
      AND (:empresa_id IS NULL OR d.empresa_id = :empresa_id)
    `,
    {
      sk_vendedor: skVendedor,
      data_inicio: trackingStartDate,
      empresa_id: empresaId ?? null,
    }
  )

  return {
    bonus: roundCurrency(rows[0]?.BONUS_TOTAL ?? rows[0]?.bonus_total),
    desafios: roundCurrency(rows[0]?.DESAFIOS_TOTAL ?? rows[0]?.desafios_total),
    challengesEnabled: true,
  }
}

function getTrackingStartDate(objectives) {
  const dates = (objectives ?? [])
    .map((objective) => parseGoalDate(objective?.criadoEm, "start"))
    .filter(Boolean)

  if (!dates.length) {
    return firstDayOfCurrentMonth()
  }

  const firstTimestamp = Math.min(...dates.map((date) => date.getTime()))
  return new Date(firstTimestamp)
}

function buildObjectiveSnapshot(objective, totalEarned) {
  const goalValue = numberValue(objective?.valorObjetivo)
  const remaining = roundCurrency(Math.max(goalValue - totalEarned, 0))
  const percentComplete = goalValue > 0 ? Number(Math.min((totalEarned / goalValue) * 100, 100).toFixed(2)) : 0
  const status = buildStatus(goalValue, totalEarned, objective?.dataLimite ?? null)

  return {
    ...objective,
    status,
    totalConquistado: roundCurrency(totalEarned),
    valorRestante: remaining,
    percentualConquistado: percentComplete,
  }
}

function buildAggregateStatus(objectives, totalGoalValue, totalEarned) {
  if (!objectives.length || totalGoalValue <= 0) {
    return "SEM_OBJETIVO"
  }

  if (totalEarned >= totalGoalValue) {
    return "CONQUISTADA"
  }

  if (objectives.some((objective) => objective.status === "EM_ANDAMENTO")) {
    return "EM_ANDAMENTO"
  }

  return "PRAZO_ENCERRADO"
}

function selectPrimaryObjective(objectives) {
  if (!objectives.length) return null
  return objectives.find((objective) => objective.status !== "CONQUISTADA") ?? objectives[0]
}

function selectClosestOpenObjective(objectives) {
  if (!objectives.length) return null

  return (
    objectives.find((objective) => objective.status === "EM_ANDAMENTO") ??
    objectives.find((objective) => objective.status !== "CONQUISTADA") ??
    objectives[0]
  )
}

function pushMessage(collection, seenIds, id, title, message, options = {}) {
  const normalizedId = textValue(id)
  const normalizedTitle = textValue(title)
  const normalizedMessage = textValue(message)

  if (!normalizedId || !normalizedTitle || !normalizedMessage || seenIds.has(normalizedId)) {
    return
  }

  seenIds.add(normalizedId)
  collection.push({
    id: normalizedId,
    title: normalizedTitle,
    message: normalizedMessage,
    actionLabel: textValue(options.actionLabel),
    actionHref: textValue(options.actionHref),
  })
}

function buildSuggestions({
  profile,
  objectives,
  totalGoalValue,
  remainingTotal,
  totalEarned,
  commissionAmount,
  commissionSource,
  salesPerDayMonth,
  salesPerDayDeadline,
  closestDeadline,
  commissionRate,
  marketInsights,
}) {
  const suggestions = []
  const seenIds = new Set()

  if (!objectives.length) {
    pushMessage(
      suggestions,
      seenIds,
      "painel",
      "Transforme venda em conquista",
      "Cadastre seus objetivos pessoais para ligar o resultado comercial ao que importa fora do trabalho."
    )
    pushMessage(
      suggestions,
      seenIds,
      "tracao",
      "Seu motor deste mes",
      commissionSource === "oracle"
        ? `Sua comissao a pagar no ciclo atual ja soma ${formatCurrencyBRL(commissionAmount)}.`
        : `Sua comissao estimada no ciclo atual ja soma ${formatCurrencyBRL(commissionAmount)}.`
    )
  } else if (remainingTotal <= 0) {
    pushMessage(
      suggestions,
      seenIds,
      "conquista",
      "Painel coberto",
      `Voce ja acumulou ${formatCurrencyBRL(totalEarned)} e cobriu ${formatCurrencyBRL(totalGoalValue)} em objetivos pessoais.`
    )
    pushMessage(
      suggestions,
      seenIds,
      "proxima",
      "Mantenha o embalo",
      "Seu painel pessoal ja foi financiado. Agora e hora de escolher a proxima conquista e continuar vendendo forte."
    )
  } else {
    pushMessage(
      suggestions,
      seenIds,
      "faltante",
      "Falta pouco para seus objetivos",
      `Faltam ${formatCurrencyBRL(remainingTotal)} para cobrir seus objetivos ativos.`
    )

    if (salesPerDayMonth > 0) {
      pushMessage(
        suggestions,
        seenIds,
        "mes",
        "Plano ate o fim do mes",
        `Se vender ${formatCurrencyBRL(salesPerDayMonth)} por dia, voce cobre sua necessidade total ate o final do mes.`
      )
    }

    if (salesPerDayDeadline > 0 && closestDeadline) {
      pushMessage(
        suggestions,
        seenIds,
        "prazo",
        "Plano ate o proximo prazo",
        `Mantendo ${formatCurrencyBRL(salesPerDayDeadline)} por dia em vendas, voce chega la ate ${new Date(closestDeadline).toLocaleDateString("pt-BR")}.`
      )
    }

    if (objectives.length > 1) {
      pushMessage(
        suggestions,
        seenIds,
        "multiplos",
        "Voce esta construindo mais de uma conquista",
        `${objectives.length} objetivos estao sendo puxados pelo mesmo resultado comercial deste ciclo.`
      )
    }
  }

  if (numberValue(profile?.rendaDesejada) > 0) {
    const salarioFixo = numberValue(profile?.salarioFixo)
    const comissaoDesejada = numberValue(profile?.comissaoDesejada)

    pushMessage(
      suggestions,
      seenIds,
      "renda",
      "Renda desejada do mes",
      salarioFixo > 0 || comissaoDesejada > 0
        ? `Seu plano do mes junta ${formatCurrencyBRL(salarioFixo)} de salario fixo com ${formatCurrencyBRL(comissaoDesejada)} de comissao desejada, totalizando ${formatCurrencyBRL(profile.rendaDesejada)}.`
        : `Voce quer ganhar ${formatCurrencyBRL(profile.rendaDesejada)} neste mes.`
    )
  }

  const motivoNormalizado = normalizeComparisonText(profile?.motivoTrabalho)
  if (motivoNormalizado.includes("FAMIL")) {
    pushMessage(
      suggestions,
      seenIds,
      "motivo-familia",
      "Seu esforco tem destino",
      "Seu esforco esta ajudando sua familia a ficar mais perto do que importa."
    )
  } else if (profile?.motivoTrabalho) {
    pushMessage(
      suggestions,
      seenIds,
      "motivo",
      "Seu motivo esta claro",
      `Seu trabalho tem um por que concreto: ${profile.motivoTrabalho}.`
    )
  }

  if (profile?.paraQuemTrabalha) {
    pushMessage(
      suggestions,
      seenIds,
      "para-quem",
      "Quem voce leva com voce",
      "Seu esforco tambem impacta quem caminha com voce nessa jornada."
    )
  }

  if (!objectives.length && profile?.objetivosPessoais) {
    pushMessage(
      suggestions,
      seenIds,
      "objetivos-pessoais",
      "Comece pelo que ja importa",
      `Transforme ${profile.objetivosPessoais} em objetivos mensuraveis dentro do seu painel pessoal.`
    )
  }

  if (marketInsights?.championOpportunity?.championsCount > 0) {
    pushMessage(
      suggestions,
      seenIds,
      "campeoes",
      "Carteira quente",
      `${marketInsights.championOpportunity.championsCount} clientes campeoes seguem na sua carteira e podem acelerar sua conquista.`,
      {
        actionLabel: "Ir para Area de Ataque",
        actionHref: "/area-ataque",
      }
    )
  }

  return suggestions.slice(0, 6)
}

function buildRecommendations({ profile, marketInsights }) {
  const recommendations = []
  const seenIds = new Set()

  if (profile?.preferenciasProduto && marketInsights?.preferredOpenQuotes?.count > 0) {
    pushMessage(
      recommendations,
      seenIds,
      "preferencia-oportunidade",
      "Sua preferencia esta pedindo abordagem",
      `Voce tem ${marketInsights.preferredOpenQuotes.count} orcamentos em aberto de ${marketInsights.preferredOpenQuotes.category}.`
    )
  } else if (profile?.preferenciasProduto) {
    pushMessage(
      recommendations,
      seenIds,
      "preferencia-base",
      "Use sua preferencia como alavanca",
      `Sua preferencia por ${profile.preferenciasProduto} pode orientar abordagens mais consultivas nas proximas negociacoes.`
    )
  }

  if (marketInsights?.preferredOpenQuotes?.value > 0) {
    pushMessage(
      recommendations,
      seenIds,
      "preferencia-valor",
      "Volume em aberto na categoria",
      `Esses orcamentos somam ${formatCurrencyBRL(marketInsights.preferredOpenQuotes.value)} em potencial de venda.`
    )
  }

  if (marketInsights?.championOpportunity?.championsWithOpenQuotes > 0) {
    const championLabel = marketInsights.championOpportunity.topChampionName
      ? `, com destaque para ${marketInsights.championOpportunity.topChampionName}`
      : ""

    pushMessage(
      recommendations,
      seenIds,
      "campeoes-oportunidade",
      "Clientes campeoes sao sua maior chance de venda",
      `${marketInsights.championOpportunity.championsWithOpenQuotes} clientes campeoes tem orcamento em aberto${championLabel}.`,
      {
        actionLabel: "Abrir Area de Ataque",
        actionHref: "/area-ataque",
      }
    )
  } else if (marketInsights?.championOpportunity?.championsCount > 0) {
    pushMessage(
      recommendations,
      seenIds,
      "campeoes-base",
      "Proteja sua carteira forte",
      `${marketInsights.championOpportunity.championsCount} clientes campeoes ainda sao sua base mais valiosa para novas conversoes.`,
      {
        actionLabel: "Abrir Area de Ataque",
        actionHref: "/area-ataque",
      }
    )
  }

  if (!recommendations.length) {
    pushMessage(
      recommendations,
      seenIds,
      "geral",
      "Leia os sinais do seu territorio",
      "Cruze preferencias, clientes quentes e orcamentos em aberto para escolher o proximo contato de maior impacto."
    )
  }

  return recommendations.slice(0, 4)
}

async function loadPreferredCategoryOpenQuotes(seller, profile) {
  const preference = textValue(profile?.preferenciasProduto)
  if (!preference || !seller?.vendedorId) return null

  try {
    const orcamentosLojaColumn = await resolveLojaColumnName(seller.empresaId, "VW_ORCAMENTOS_GESTAO_METAS")
    const orcamentosLojaCondition = buildLojaInCondition(
      orcamentosLojaColumn ? `o.${orcamentosLojaColumn}` : null,
      seller.lojaScope,
      "meta_vida_preferencia_loja"
    )
    const rows = await query(
      `
      WITH base AS (
        SELECT
          NVL(p.nome_pai_nivel1, 'Sem grupo') AS grupo,
          COUNT(*) AS total_orcamentos,
          NVL(SUM(NVL(o.valor, 0)), 0) AS valor_total
        FROM DM_VENDAS.VW_ORCAMENTOS_GESTAO_METAS o
        LEFT JOIN DM_VENDAS.DIM_PRODUTOS p
          ON p.sk_produto = o.sk_produto
        WHERE o.vendedor_id = :vendedor_id
          AND ${orcamentosLojaCondition.clause}
        GROUP BY NVL(p.nome_pai_nivel1, 'Sem grupo')
      )
      SELECT grupo, total_orcamentos, valor_total
      FROM (
        SELECT grupo, total_orcamentos, valor_total
        FROM base
        WHERE UPPER(TRIM(grupo)) LIKE :preferencia
        ORDER BY total_orcamentos DESC, valor_total DESC
      )
      WHERE ROWNUM = 1
      `,
      {
        vendedor_id: seller.vendedorId,
        preferencia: `%${normalizeComparisonText(preference)}%`,
        ...orcamentosLojaCondition.binds,
      }
    )

    const item = normalizeRow(rows[0] ?? {})
    const count = numberValue(item.total_orcamentos)
    if (!count) {
      return null
    }

    return {
      category: textValue(item.grupo) ?? preference,
      count,
      value: roundCurrency(item.valor_total),
    }
  } catch (error) {
    const oracleCode = getOracleErrorCode(error)
    if (oracleCode === ORACLE_TABLE_NOT_FOUND || oracleCode === ORACLE_INVALID_IDENTIFIER) {
      return null
    }

    throw error
  }
}

// FATO_RFV_VENDEDOR nao tem coluna de loja - nao aplicar filtro nela. VW_ORCAMENTOS_GESTAO_METAS
// tem, entao o filtro de loja entra so na CTE orcamentos_cliente.
async function loadChampionOpportunity(seller) {
  if (!seller?.skVendedor || !seller?.vendedorId) {
    return null
  }

  const orcamentosLojaColumn = await resolveLojaColumnName(seller.empresaId, "VW_ORCAMENTOS_GESTAO_METAS")
  const orcamentosLojaCondition = buildLojaInCondition(orcamentosLojaColumn, seller.lojaScope, "meta_vida_campeoes_loja")

  const binds = {
    vendedor_id: seller.skVendedor,
    vendedor_comercial: seller.vendedorId,
    ...orcamentosLojaCondition.binds,
  }

  const [summaryRows, topRows] = await Promise.all([
    query(
      `
      WITH orcamentos_cliente AS (
        SELECT
          UPPER(TRIM(NVL(cliente, ''))) AS cliente_norm,
          COUNT(*) AS orcamentos_abertos,
          NVL(SUM(NVL(valor, 0)), 0) AS valor_total
        FROM DM_VENDAS.VW_ORCAMENTOS_GESTAO_METAS
        WHERE vendedor_id = :vendedor_comercial
          AND ${orcamentosLojaCondition.clause}
        GROUP BY UPPER(TRIM(NVL(cliente, '')))
      )
      SELECT
        COUNT(*) AS total_campeoes,
        SUM(CASE WHEN NVL(orc.orcamentos_abertos, 0) > 0 THEN 1 ELSE 0 END) AS campeoes_com_orcamento,
        NVL(SUM(NVL(orc.orcamentos_abertos, 0)), 0) AS orcamentos_abertos_campeoes
      FROM DM_VENDAS.FATO_RFV_VENDEDOR rfv
      LEFT JOIN orcamentos_cliente orc
        ON UPPER(TRIM(NVL(rfv.nome_cliente, ''))) = orc.cliente_norm
      WHERE rfv.sk_vendedor = :vendedor_id
        AND UPPER(TRIM(rfv.classificacao)) LIKE 'CAMPE%'
      `,
      binds
    ),
    query(
      `
      WITH orcamentos_cliente AS (
        SELECT
          UPPER(TRIM(NVL(cliente, ''))) AS cliente_norm,
          COUNT(*) AS orcamentos_abertos,
          NVL(SUM(NVL(valor, 0)), 0) AS valor_total
        FROM DM_VENDAS.VW_ORCAMENTOS_GESTAO_METAS
        WHERE vendedor_id = :vendedor_comercial
          AND ${orcamentosLojaCondition.clause}
        GROUP BY UPPER(TRIM(NVL(cliente, '')))
      )
      SELECT *
      FROM (
        SELECT
          rfv.nome_cliente,
          NVL(orc.orcamentos_abertos, 0) AS orcamentos_abertos,
          NVL(orc.valor_total, 0) AS valor_total
        FROM DM_VENDAS.FATO_RFV_VENDEDOR rfv
        LEFT JOIN orcamentos_cliente orc
          ON UPPER(TRIM(NVL(rfv.nome_cliente, ''))) = orc.cliente_norm
        WHERE rfv.sk_vendedor = :vendedor_id
          AND UPPER(TRIM(rfv.classificacao)) LIKE 'CAMPE%'
          AND NVL(orc.orcamentos_abertos, 0) > 0
        ORDER BY NVL(orc.valor_total, 0) DESC, NVL(orc.orcamentos_abertos, 0) DESC
      )
      WHERE ROWNUM = 1
      `,
      binds
    ),
  ])

  const summary = normalizeRow(summaryRows[0] ?? {})
  const topChampion = normalizeRow(topRows[0] ?? {})

  return {
    championsCount: numberValue(summary.total_campeoes),
    championsWithOpenQuotes: numberValue(summary.campeoes_com_orcamento),
    openQuotesCount: numberValue(summary.orcamentos_abertos_campeoes),
    topChampionName: textValue(topChampion.nome_cliente),
    topChampionValue: roundCurrency(topChampion.valor_total),
  }
}

async function loadMarketInsights(seller, profile) {
  const [preferredOpenQuotes, championOpportunity] = await Promise.all([
    loadPreferredCategoryOpenQuotes(seller, profile),
    loadChampionOpportunity(seller),
  ])

  return {
    preferredOpenQuotes,
    championOpportunity,
  }
}

async function loadProfileContext(seller) {
  const profileEnabled = await isProfileModuleReady()
  if (!profileEnabled) {
    return {
      profile: null,
      profileEnabled: false,
    }
  }

  return {
    profile: await loadProfileBySeller(seller),
    profileEnabled: true,
  }
}

function buildGoalPayload({
  context,
  objectives,
  profile,
  profileEnabled,
  commissionSnapshot,
  challengeRewards,
  marketInsights,
}) {
  const salesRevenue = roundCurrency(commissionSnapshot?.salesRevenue)
  const commissionAmount = roundCurrency(commissionSnapshot?.commissionAmount)
  const effectiveCommissionRate =
    numberValue(commissionSnapshot?.commissionRate) > 0
      ? numberValue(commissionSnapshot.commissionRate)
      : DEFAULT_COMMISSION_RATE
  const commissionSource = textValue(commissionSnapshot?.source) ?? "estimada"
  const totalEarned = roundCurrency(
    commissionAmount + challengeRewards.bonus + challengeRewards.desafios
  )
  const objectiveSnapshots = objectives.map((objective) => buildObjectiveSnapshot(objective, totalEarned))
  const totalGoalValue = roundCurrency(
    objectiveSnapshots.reduce((sum, objective) => sum + numberValue(objective.valorObjetivo), 0)
  )
  const remaining = roundCurrency(Math.max(totalGoalValue - totalEarned, 0))
  const percentComplete = totalGoalValue > 0 ? Number(Math.min((totalEarned / totalGoalValue) * 100, 100).toFixed(2)) : 0
  const primaryObjective = selectPrimaryObjective(objectiveSnapshots)
  const closestObjective = selectClosestOpenObjective(objectiveSnapshots)
  const trackingStartDate = getTrackingStartDate(objectives)
  const closestDeadline = closestObjective?.dataLimite ?? null
  const daysToDeadline = closestDeadline ? daysUntilInclusive(closestDeadline) : 0
  const daysToMonthEnd = daysUntilInclusive(endOfCurrentMonth())
  const salesPerDayMonth =
    remaining > 0 && daysToMonthEnd > 0 && effectiveCommissionRate > 0
      ? roundCurrency(remaining / effectiveCommissionRate / daysToMonthEnd)
      : 0
  const salesPerDayDeadline =
    remaining > 0 && daysToDeadline > 0 && effectiveCommissionRate > 0
      ? roundCurrency(remaining / effectiveCommissionRate / daysToDeadline)
      : 0
  const status = buildAggregateStatus(objectiveSnapshots, totalGoalValue, totalEarned)

  return {
    status,
    seller: {
      skVendedor: context.skVendedor,
      vendedorId: context.vendedorId,
      empresaId: context.empresaId,
      nomeVendedor: context.nomeVendedor,
    },
    profile,
    objective: primaryObjective ?? null,
    objectives: objectiveSnapshots,
    summary: {
      quantidadeObjetivos: objectiveSnapshots.length,
      valorTotalObjetivos: totalGoalValue,
      ganhoTotal: totalEarned,
      faltaTotal: remaining,
      percentualTotal: percentComplete,
      objetivosConquistados: objectiveSnapshots.filter((objective) => objective.status === "CONQUISTADA").length,
    },
    tracking: {
      startedAt: trackingStartDate,
      deadlineAt: closestDeadline,
      closestDeadlineAt: closestDeadline,
      daysToDeadline,
      daysToClosestDeadline: daysToDeadline,
      daysToMonthEnd,
      commissionRate: effectiveCommissionRate,
      commissionRatePercent: Number((effectiveCommissionRate * 100).toFixed(2)),
    },
    ganhos: {
      faturamentoConsiderado: roundCurrency(salesRevenue),
      comissao: commissionAmount,
      comissaoOrigem: commissionSource,
      bonus: roundCurrency(challengeRewards.bonus),
      desafios: roundCurrency(challengeRewards.desafios),
      totalConquistado: totalEarned,
      valorRestante: remaining,
      percentualConquistado: percentComplete,
      valorTotalObjetivos: totalGoalValue,
      quantidadeObjetivos: objectiveSnapshots.length,
    },
    simulator: {
      taxaComissao: effectiveCommissionRate,
      valorBaseSugerido: salesPerDayMonth > 0 ? salesPerDayMonth : 5000,
      comissaoEstimadaValorBase: roundCurrency((salesPerDayMonth > 0 ? salesPerDayMonth : 5000) * effectiveCommissionRate),
      vendaDiariaNecessariaAteFimDoMes: salesPerDayMonth,
      vendaDiariaNecessariaAtePrazo: salesPerDayDeadline,
    },
    suggestions: buildSuggestions({
      profile,
      objectives: objectiveSnapshots,
      totalGoalValue,
      remainingTotal: remaining,
      totalEarned,
      commissionAmount,
      commissionSource,
      salesPerDayMonth,
      salesPerDayDeadline,
      closestDeadline,
      commissionRate: effectiveCommissionRate,
      marketInsights,
    }),
    recommendations: buildRecommendations({
      profile,
      marketInsights,
    }),
    insights: {
      preferredOpenQuotes: marketInsights?.preferredOpenQuotes
        ? {
            category: textValue(marketInsights.preferredOpenQuotes.category),
            count: numberValue(marketInsights.preferredOpenQuotes.count),
            value: roundCurrency(marketInsights.preferredOpenQuotes.value),
          }
        : null,
      championOpportunity: marketInsights?.championOpportunity
        ? {
            championsCount: numberValue(marketInsights.championOpportunity.championsCount),
            championsWithOpenQuotes: numberValue(marketInsights.championOpportunity.championsWithOpenQuotes),
            openQuotesCount: numberValue(marketInsights.championOpportunity.openQuotesCount),
            topChampionName: textValue(marketInsights.championOpportunity.topChampionName),
            topChampionValue: roundCurrency(marketInsights.championOpportunity.topChampionValue),
          }
        : null,
    },
    capabilities: {
      challengesEnabled: challengeRewards.challengesEnabled,
      profileEnabled,
      profileScriptPath: profileEnabled ? null : PROFILE_SCRIPT_PATH,
      multipleObjectives: true,
    },
  }
}

function validateObjectivePayload(payload) {
  const nomeObjetivo = textValue(payload?.nome_objetivo ?? payload?.nomeObjetivo)
  const valorObjetivo = roundCurrency(payload?.valor_objetivo ?? payload?.valorObjetivo)
  const dataLimite = parseGoalDate(payload?.data_limite ?? payload?.dataLimite, "end")

  if (!nomeObjetivo) {
    throw createServiceError("OBJECTIVE_NAME_REQUIRED", "nome_objetivo e obrigatorio.", 400)
  }

  if (valorObjetivo <= 0) {
    throw createServiceError("OBJECTIVE_VALUE_INVALID", "valor_objetivo deve ser maior que zero.", 400)
  }

  if (!dataLimite) {
    throw createServiceError("OBJECTIVE_DATE_REQUIRED", "data_limite e obrigatoria.", 400)
  }

  return {
    nomeObjetivo,
    valorObjetivo,
    dataLimite,
  }
}

function validateProfilePayload(payload) {
  const rendaDesejadaLegada = optionalNumberValue(payload?.renda_desejada ?? payload?.rendaDesejada)
  const salarioFixo = optionalNumberValue(payload?.salario_fixo ?? payload?.salarioFixo)
  const comissaoDesejada = optionalNumberValue(payload?.comissao_desejada ?? payload?.comissaoDesejada)
  const hasIncomeBreakdown = salarioFixo !== null || comissaoDesejada !== null
  const rendaDesejada = hasIncomeBreakdown
    ? roundCurrency(numberValue(salarioFixo) + numberValue(comissaoDesejada))
    : rendaDesejadaLegada

  if (rendaDesejada !== null && rendaDesejada < 0) {
    throw createServiceError(
      "PROFILE_DESIRED_INCOME_INVALID",
      "renda_desejada deve ser maior ou igual a zero.",
      400
    )
  }

  if (salarioFixo !== null && salarioFixo < 0) {
    throw createServiceError(
      "PROFILE_FIXED_SALARY_INVALID",
      "salario_fixo deve ser maior ou igual a zero.",
      400
    )
  }

  if (comissaoDesejada !== null && comissaoDesejada < 0) {
    throw createServiceError(
      "PROFILE_DESIRED_COMMISSION_INVALID",
      "comissao_desejada deve ser maior ou igual a zero.",
      400
    )
  }

  return {
    rendaDesejada,
    salarioFixo,
    comissaoDesejada,
    motivoTrabalho: textValue(payload?.motivo_trabalho ?? payload?.motivoTrabalho),
    paraQuemTrabalha: textValue(payload?.para_quem_trabalha ?? payload?.paraQuemTrabalha),
    objetivosPessoais: textValue(payload?.objetivos_pessoais ?? payload?.objetivosPessoais),
    preferenciasProduto: textValue(payload?.preferencias_produto ?? payload?.preferenciasProduto),
  }
}

export async function getSellerLifeGoal(vendorCode, fallback = {}) {
  const empresaId = requireEmpresaId(fallback, "buscar a meta de vida")
  return withObjetivoDbContext(empresaId, async () => {
    await ensureObjectiveModuleReady()

    const seller = await resolveSellerContext(vendorCode, fallback)
    const objectives = await loadObjectivesBySeller(seller)
    const trackingStartDate = getTrackingStartDate(objectives)
    const [profileContext, commissionSnapshot, challengeRewards] = await Promise.all([
      loadProfileContext(seller),
      resolveCommissionSnapshot(seller, trackingStartDate),
      calculateChallengeRewards(seller.skVendedor, trackingStartDate, seller.empresaId),
    ])
    const marketInsights = await loadMarketInsights(seller, profileContext.profile)

    return buildGoalPayload({
      context: seller,
      objectives,
      profile: profileContext.profile,
      profileEnabled: profileContext.profileEnabled,
      commissionSnapshot,
      challengeRewards,
      marketInsights,
    })
  })
}

export async function getSellerLifeGoals(vendorCode, fallback = {}) {
  const panel = await getSellerLifeGoal(vendorCode, fallback)
  return {
    seller: panel.seller,
    objectives: panel.objectives,
    summary: panel.summary,
  }
}

export async function createSellerLifeGoal(payload) {
  const empresaId = requireEmpresaId(payload, "criar o objetivo")
  return withObjetivoDbContext(empresaId, async () => {
    await ensureObjectiveModuleReady()

  const sellerCode = payload?.sk_vendedor ?? payload?.skVendedor ?? payload?.vendedor_id ?? payload?.vendedorId
  if (!sellerCode) {
    throw createServiceError("SELLER_REQUIRED", "vendedor_id e obrigatorio para criar o objetivo.", 400)
  }

  const objectiveData = validateObjectivePayload(payload)
  const seller = await resolveSellerContext(sellerCode, payload)

  if (!seller.empresaId) {
    throw createServiceError("COMPANY_REQUIRED", "empresa_id e obrigatorio para criar o objetivo.", 400)
  }

  const idObjetivo = await nextSequenceValue(OBJECTIVE_SEQUENCE)
  const objectiveTable = await getObjectivesTableName()

  try {
    await query(
      `
      INSERT INTO ${objectiveTable} (
        id_objetivo,
        empresa_id,
        vendedor_id,
        sk_vendedor,
        nome_objetivo,
        valor_objetivo,
        data_limite,
        ativo,
        criado_em,
        atualizado_em
      )
      VALUES (
        :id_objetivo,
        :empresa_id,
        :vendedor_id,
        :sk_vendedor,
        :nome_objetivo,
        :valor_objetivo,
        :data_limite,
        'S',
        SYSDATE,
        SYSDATE
      )
      `,
      {
        id_objetivo: idObjetivo,
        empresa_id: seller.empresaId,
        vendedor_id: seller.vendedorId,
        sk_vendedor: seller.skVendedor ?? null,
        nome_objetivo: objectiveData.nomeObjetivo,
        valor_objetivo: objectiveData.valorObjetivo,
        data_limite: objectiveData.dataLimite,
      }
    )
  } catch (error) {
    if (getOracleErrorCode(error) === ORACLE_UNIQUE_VIOLATION) {
      throw createServiceError(
        "OBJECTIVE_SCHEMA_OUTDATED",
        "A estrutura atual da Meta de Vida ainda bloqueia multiplos objetivos. Execute a migracao SQL antes de criar novas metas.",
        503,
        {
          scriptPath: OBJECTIVE_UPGRADE_SCRIPT_PATH,
          instructions: [
            "Execute o DDL principal para garantir a estrutura atualizada da tabela OBJETIVOS_VENDEDOR.",
            "Depois repita a criacao do novo objetivo.",
          ],
          originalMessage: error.message,
        }
      )
    }

    throw error
  }

    return getSellerLifeGoal(seller.skVendedor ?? seller.vendedorId, { empresa_id: seller.empresaId })
  })
}

export async function updateSellerLifeGoal(idObjetivo, payload) {
  const empresaId = requireEmpresaId(payload, "atualizar o objetivo")
  return withObjetivoDbContext(empresaId, async () => {
    await ensureObjectiveModuleReady()

  const currentObjective = await loadObjectiveById(idObjetivo)
  if (!currentObjective) {
    throw createServiceError("OBJECTIVE_NOT_FOUND", "Objetivo do vendedor nao encontrado.", 404)
  }

  const sellerCode =
    payload?.sk_vendedor ??
    payload?.skVendedor ??
    payload?.vendedor_id ??
    payload?.vendedorId ??
    currentObjective.skVendedor ??
    currentObjective.vendedorId

  const seller = await resolveSellerContext(sellerCode, payload)

  if (
    String(currentObjective.vendedorId ?? "") !== String(seller.vendedorId ?? "") &&
    String(currentObjective.skVendedor ?? "") !== String(seller.skVendedor ?? "")
  ) {
    throw createServiceError("OBJECTIVE_FORBIDDEN", "Este objetivo nao pertence ao vendedor informado.", 403)
  }

  if (seller.empresaId && String(currentObjective.empresaId ?? "") !== String(seller.empresaId)) {
    throw createServiceError("OBJECTIVE_FORBIDDEN", "Este objetivo nao pertence a empresa informada.", 403)
  }

  const objectiveData = validateObjectivePayload(payload)
  const objectiveTable = await getObjectivesTableName()

  await query(
    `
    UPDATE ${objectiveTable}
    SET nome_objetivo = :nome_objetivo,
        valor_objetivo = :valor_objetivo,
        data_limite = :data_limite,
        atualizado_em = SYSDATE
    WHERE id_objetivo = :id_objetivo
    `,
    {
      id_objetivo: idObjetivo,
      nome_objetivo: objectiveData.nomeObjetivo,
      valor_objetivo: objectiveData.valorObjetivo,
      data_limite: objectiveData.dataLimite,
    }
  )

    return getSellerLifeGoal(currentObjective.skVendedor ?? currentObjective.vendedorId, { empresa_id: seller.empresaId ?? currentObjective.empresaId })
  })
}

export async function getSellerProfile(vendorCode, fallback = {}) {
  const empresaId = requireEmpresaId(fallback, "buscar o perfil")
  return withObjetivoDbContext(empresaId, async () => {
    await ensureProfileModuleReady()

    const seller = await resolveSellerContext(vendorCode, fallback)
    const profile = await loadProfileBySeller(seller)

    return {
      seller: {
        skVendedor: seller.skVendedor,
        vendedorId: seller.vendedorId,
        empresaId: seller.empresaId,
        nomeVendedor: seller.nomeVendedor,
      },
      profile,
    }
  })
}

export async function createSellerProfile(payload) {
  const empresaId = requireEmpresaId(payload, "criar o perfil")
  return withObjetivoDbContext(empresaId, async () => {
    await ensureProfileModuleReady()

  const sellerCode = payload?.sk_vendedor ?? payload?.skVendedor ?? payload?.vendedor_id ?? payload?.vendedorId
  if (!sellerCode) {
    throw createServiceError("SELLER_REQUIRED", "vendedor_id e obrigatorio para criar o perfil.", 400)
  }

  const seller = await resolveSellerContext(sellerCode, payload)
  if (!seller.empresaId) {
    throw createServiceError("COMPANY_REQUIRED", "empresa_id e obrigatorio para criar o perfil.", 400)
  }

  const existingProfile = await loadProfileBySeller(seller)
  if (existingProfile) {
    throw createServiceError(
      "PROFILE_ALREADY_EXISTS",
      "Este vendedor ja possui um perfil cadastrado. Use PUT para atualizar.",
      409,
      { profileId: existingProfile.id }
    )
  }

  const profileData = validateProfilePayload(payload)
  const idPerfil = await nextSequenceValue(PROFILE_SEQUENCE)
  const supportsIncomeBreakdown = await profileIncomeBreakdownReady()
  const profileTable = await getProfileTableName()
  const insertColumns = [
    "id",
    "vendedor_id",
    "empresa_id",
    "renda_desejada",
    "motivo_trabalho",
    "para_quem_trabalha",
    "objetivos_pessoais",
    "preferencias_produto",
    "criado_em",
  ]
  const insertValues = [
    ":id",
    ":vendedor_id",
    ":empresa_id",
    ":renda_desejada",
    ":motivo_trabalho",
    ":para_quem_trabalha",
    ":objetivos_pessoais",
    ":preferencias_produto",
    "SYSDATE",
  ]
  const insertBinds = {
    id: idPerfil,
    vendedor_id: seller.vendedorId,
    empresa_id: seller.empresaId,
    renda_desejada: profileData.rendaDesejada,
    motivo_trabalho: profileData.motivoTrabalho,
    para_quem_trabalha: profileData.paraQuemTrabalha,
    objetivos_pessoais: profileData.objetivosPessoais,
    preferencias_produto: profileData.preferenciasProduto,
  }

  if (supportsIncomeBreakdown) {
    insertColumns.splice(4, 0, "salario_fixo", "comissao_desejada")
    insertValues.splice(4, 0, ":salario_fixo", ":comissao_desejada")
    insertBinds.salario_fixo = profileData.salarioFixo
    insertBinds.comissao_desejada = profileData.comissaoDesejada
  }

  await query(
    `
    INSERT INTO ${profileTable} (
      ${insertColumns.join(",\n      ")}
    )
    VALUES (
      ${insertValues.join(",\n      ")}
    )
    `,
    insertBinds
  )

    return getSellerProfile(seller.skVendedor ?? seller.vendedorId, { empresa_id: seller.empresaId })
  })
}

export async function updateSellerProfile(idPerfil, payload) {
  const empresaId = requireEmpresaId(payload, "atualizar o perfil")
  return withObjetivoDbContext(empresaId, async () => {
    await ensureProfileModuleReady()

  const currentProfile = await loadProfileById(idPerfil)
  if (!currentProfile) {
    throw createServiceError("PROFILE_NOT_FOUND", "Perfil do vendedor nao encontrado.", 404)
  }

  const sellerCode =
    payload?.sk_vendedor ??
    payload?.skVendedor ??
    payload?.vendedor_id ??
    payload?.vendedorId ??
    currentProfile.vendedorId

  const seller = await resolveSellerContext(sellerCode, payload)

  if (String(currentProfile.vendedorId ?? "") !== String(seller.vendedorId ?? "")) {
    throw createServiceError("PROFILE_FORBIDDEN", "Este perfil nao pertence ao vendedor informado.", 403)
  }

  if (seller.empresaId && String(currentProfile.empresaId ?? "") !== String(seller.empresaId)) {
    throw createServiceError("PROFILE_FORBIDDEN", "Este perfil nao pertence a empresa informada.", 403)
  }

  const profileData = validateProfilePayload(payload)
  const supportsIncomeBreakdown = await profileIncomeBreakdownReady()
  const profileTable = await getProfileTableName()
  const updateSets = [
    "renda_desejada = :renda_desejada",
    "motivo_trabalho = :motivo_trabalho",
    "para_quem_trabalha = :para_quem_trabalha",
    "objetivos_pessoais = :objetivos_pessoais",
    "preferencias_produto = :preferencias_produto",
  ]
  const updateBinds = {
    id: idPerfil,
    renda_desejada: profileData.rendaDesejada,
    motivo_trabalho: profileData.motivoTrabalho,
    para_quem_trabalha: profileData.paraQuemTrabalha,
    objetivos_pessoais: profileData.objetivosPessoais,
    preferencias_produto: profileData.preferenciasProduto,
  }

  if (supportsIncomeBreakdown) {
    updateSets.splice(1, 0, "salario_fixo = :salario_fixo", "comissao_desejada = :comissao_desejada")
    updateBinds.salario_fixo = profileData.salarioFixo
    updateBinds.comissao_desejada = profileData.comissaoDesejada
  }

  await query(
    `
    UPDATE ${profileTable}
    SET ${updateSets.join(",\n        ")}
    WHERE id = :id
    `,
    updateBinds
  )

    return getSellerProfile(currentProfile.vendedorId, { empresa_id: seller.empresaId ?? currentProfile.empresaId })
  })
}

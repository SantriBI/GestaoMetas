import express from "express"
import bcrypt from "bcrypt"
import { query } from "../db/oracle.js"

const router = express.Router()
const ORACLE_TABLE_NOT_FOUND = 942
const FORNECEDOR_TABLE = "FORNECEDORES_LOGIN"
const FORNECEDOR_SQL_PATH = "Back/sql/fornecedores_login.sql"

function numberValue(value) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function textValue(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text || null
}

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
}

function roundCurrency(value) {
  return Number(numberValue(value).toFixed(2))
}

function roundVolume(value) {
  return Number(numberValue(value).toFixed(1))
}

function getOracleErrorCode(err) {
  if (typeof err?.errorNum === "number") {
    return err.errorNum
  }

  const match = String(err?.message ?? "").match(/ORA-(\d{5})/)
  return match ? Number(match[1]) : null
}

function buildSignedRevenueSql(alias = "f") {
  return `
    CASE
      WHEN ${alias}.tipo = 'DEV' THEN NVL(${alias}.valor_liquido_item, 0) * -1
      ELSE NVL(${alias}.valor_liquido_item, 0)
    END
  `
}

function normalizeBrand(value) {
  return String(value ?? "").trim().toUpperCase()
}

function createDateAtStart(year, month, day) {
  const date = new Date(year, month, day)
  date.setHours(0, 0, 0, 0)
  return date
}

function createDateAtEnd(year, month, day) {
  const date = new Date(year, month, day)
  date.setHours(23, 59, 59, 999)
  return date
}

function getMonthComparisonWindow(now = new Date()) {
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const currentDay = now.getDate()
  const previousMonthDate = new Date(currentYear, currentMonth - 1, 1)
  const previousYear = previousMonthDate.getFullYear()
  const previousMonth = previousMonthDate.getMonth()
  const lastDayPreviousMonth = new Date(previousYear, previousMonth + 1, 0).getDate()
  const alignedPreviousDay = Math.min(currentDay, lastDayPreviousMonth)

  return {
    currentStart: createDateAtStart(currentYear, currentMonth, 1),
    currentEnd: createDateAtEnd(currentYear, currentMonth, currentDay),
    previousStart: createDateAtStart(previousYear, previousMonth, 1),
    previousEnd: createDateAtEnd(previousYear, previousMonth, alignedPreviousDay),
  }
}

function formatRangeLabel(start, end) {
  const safeStart = start instanceof Date ? start : new Date(start)
  const safeEnd = end instanceof Date ? end : new Date(end)

  return `${safeStart.toLocaleDateString("pt-BR")} a ${safeEnd.toLocaleDateString("pt-BR")}`
}

function calculateGrowth(current, previous) {
  const currentValue = numberValue(current)
  const previousValue = numberValue(previous)

  if (previousValue <= 0) {
    return currentValue > 0 ? 100 : 0
  }

  return Number((((currentValue - previousValue) / previousValue) * 100).toFixed(1))
}

function calculateShare(part, whole) {
  const denominator = numberValue(whole)
  if (denominator <= 0) return 0
  return Number(((numberValue(part) / denominator) * 100).toFixed(1))
}

async function fornecedorTableReady() {
  const rows = await query(
    `
    SELECT COUNT(*) AS total
    FROM USER_TABLES
    WHERE TABLE_NAME = :table_name
    `,
    { table_name: FORNECEDOR_TABLE }
  )

  return numberValue(rows[0]?.TOTAL ?? rows[0]?.total) > 0
}

async function ensureFornecedorTableReady() {
  const ready = await fornecedorTableReady()

  if (ready) return

  const error = new Error("A tabela de login da industria ainda nao foi criada.")
  error.status = 503
  error.details = {
    scriptPath: FORNECEDOR_SQL_PATH,
    instructions: [
      "Execute o script SQL do login da industria no Oracle.",
      "Cadastre pelo menos um fornecedor ativo com senha_hash em bcrypt.",
      "Depois tente o login novamente.",
    ],
  }
  throw error
}

function parseChallengeMeta(row) {
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
    idDesafio: numberValue(item.id_desafio),
    idMeta: numberValue(item.id_meta),
    titulo: textValue(item.titulo),
    status: textValue(item.status),
    dataInicio: item.data_inicio ?? null,
    dataFim: item.data_fim ?? null,
    tipoMeta: textValue(item.tipo_meta),
    metaValor: roundCurrency(item.meta_valor),
    unidadeMeta: textValue(item.unidade_meta) ?? "R$",
    config,
  }
}

function challengeMatchesBrand(meta, marca) {
  const brand = normalizeBrand(marca)
  const config = meta?.config ?? {}
  const brandName = normalizeBrand(config.brandName)
  const targetValue = normalizeBrand(config.targetValue)

  if (brandName && brandName === brand) return true
  if (targetValue && targetValue.includes(brand)) return true
  return false
}

function getChallengePriority(meta, now = new Date()) {
  const start = meta?.dataInicio ? new Date(meta.dataInicio) : null
  const end = meta?.dataFim ? new Date(meta.dataFim) : null
  const active =
    start instanceof Date &&
    end instanceof Date &&
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    start.getTime() <= now.getTime() &&
    end.getTime() >= now.getTime()

  return active ? 10 : 1
}

async function loadBrandChallengeSummary(marca) {
  try {
    const metaRows = await query(`
      SELECT
        d.id_desafio,
        d.titulo,
        d.status,
        d.data_inicio,
        d.data_fim,
        m.id_meta,
        m.tipo_meta,
        m.meta_valor,
        m.unidade_meta,
        m.config_json
      FROM desafios_comerciais d
      JOIN desafios_comerciais_metas m
        ON m.id_desafio = d.id_desafio
      WHERE d.status <> 'CANCELADO'
        AND m.tipo_meta = 'PRODUTO_OU_MARCA'
      ORDER BY d.data_inicio DESC, d.id_desafio DESC, m.id_meta DESC
    `)

    const candidates = metaRows
      .map(parseChallengeMeta)
      .filter((item) => challengeMatchesBrand(item, marca))
      .sort((a, b) => {
        const priority = getChallengePriority(b) - getChallengePriority(a)
        if (priority !== 0) return priority
        return new Date(b.dataInicio ?? 0).getTime() - new Date(a.dataInicio ?? 0).getTime()
      })

    const selected = candidates[0]
    if (!selected) return null

    const progressRows = await query(
      `
      SELECT
        NVL(SUM(progresso_atual), 0) AS progresso_total,
        COUNT(DISTINCT sk_vendedor) AS vendedores_impactados
      FROM desafios_comerciais_progresso
      WHERE id_meta = :id_meta
      `,
      { id_meta: selected.idMeta }
    )

    const progress = normalizeRow(progressRows[0] ?? {})
    const currentValue = roundCurrency(progress.progresso_total)
    const targetValue = roundCurrency(selected.metaValor)

    return {
      source: "CHALLENGE",
      title: selected.titulo ?? `Campanha ${marca}`,
      unit: selected.unidadeMeta ?? "R$",
      currentValue,
      targetValue,
      percent: targetValue > 0 ? Number(Math.min((currentValue / targetValue) * 100, 100).toFixed(1)) : 0,
      sellersImpacted: numberValue(progress.vendedores_impactados),
      startsAt: selected.dataInicio ?? null,
      endsAt: selected.dataFim ?? null,
    }
  } catch (err) {
    if (getOracleErrorCode(err) === ORACLE_TABLE_NOT_FOUND) {
      return null
    }

    throw err
  }
}

function buildFallbackCampaignSummary(marca, faturamentoAtual, faturamentoAnterior, vendedoresImpactados) {
  const baseline = Math.max(numberValue(faturamentoAtual), numberValue(faturamentoAnterior), 1000)
  const targetValue = roundCurrency(baseline * 1.18)
  const currentValue = roundCurrency(faturamentoAtual)

  return {
    source: "ESTIMATE",
    title: `Meta executiva ${marca}`,
    unit: "R$",
    currentValue,
    targetValue,
    percent: targetValue > 0 ? Number(Math.min((currentValue / targetValue) * 100, 100).toFixed(1)) : 0,
    sellersImpacted: numberValue(vendedoresImpactados),
    startsAt: null,
    endsAt: null,
  }
}

async function loadBrandSummary(marca, window) {
  const rows = await query(
    `
    WITH base AS (
      SELECT
        ${buildSignedRevenueSql("f")} AS receita_liquida,
        NVL(f.quantidade_item, 0) AS volume_item,
        f.sk_cliente,
        f.sk_vendedor,
        f.sk_dt_recebimento AS sk_data
      FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
      JOIN DM_VENDAS.DIM_PRODUTOS p
        ON p.sk_produto = f.sk_produto
      WHERE UPPER(TRIM(NVL(p.nome_marca, ''))) = :marca
        AND f.sk_dt_recebimento IS NOT NULL
    )
    SELECT
      ROUND(
        SUM(
          CASE
            WHEN sk_data BETWEEN TO_NUMBER(TO_CHAR(:current_start, 'YYYYMMDD'))
                             AND TO_NUMBER(TO_CHAR(:current_end, 'YYYYMMDD'))
            THEN receita_liquida
            ELSE 0
          END
        ),
        2
      ) AS faturamento_atual,
      ROUND(
        SUM(
          CASE
            WHEN sk_data BETWEEN TO_NUMBER(TO_CHAR(:previous_start, 'YYYYMMDD'))
                             AND TO_NUMBER(TO_CHAR(:previous_end, 'YYYYMMDD'))
            THEN receita_liquida
            ELSE 0
          END
        ),
        2
      ) AS faturamento_anterior,
      ROUND(
        SUM(
          CASE
            WHEN sk_data BETWEEN TO_NUMBER(TO_CHAR(:current_start, 'YYYYMMDD'))
                             AND TO_NUMBER(TO_CHAR(:current_end, 'YYYYMMDD'))
            THEN volume_item
            ELSE 0
          END
        ),
        2
      ) AS volume_atual,
      ROUND(
        SUM(
          CASE
            WHEN sk_data BETWEEN TO_NUMBER(TO_CHAR(:previous_start, 'YYYYMMDD'))
                             AND TO_NUMBER(TO_CHAR(:previous_end, 'YYYYMMDD'))
            THEN volume_item
            ELSE 0
          END
        ),
        2
      ) AS volume_anterior,
      COUNT(
        DISTINCT CASE
          WHEN sk_data BETWEEN TO_NUMBER(TO_CHAR(:current_start, 'YYYYMMDD'))
                           AND TO_NUMBER(TO_CHAR(:current_end, 'YYYYMMDD'))
          THEN sk_cliente
        END
      ) AS clientes_impactados,
      COUNT(
        DISTINCT CASE
          WHEN sk_data BETWEEN TO_NUMBER(TO_CHAR(:current_start, 'YYYYMMDD'))
                           AND TO_NUMBER(TO_CHAR(:current_end, 'YYYYMMDD'))
          THEN sk_vendedor
        END
      ) AS vendedores_impactados
    FROM base
    `,
    {
      marca,
      current_start: window.currentStart,
      current_end: window.currentEnd,
      previous_start: window.previousStart,
      previous_end: window.previousEnd,
    }
  )

  return normalizeRow(rows[0] ?? {})
}

async function loadBrandRanking(marca, window) {
  const rows = await query(
    `
    WITH base AS (
      SELECT
        f.sk_vendedor,
        TRIM(SUBSTR(MAX(NVL(v.nome_vendedor, 'Vendedor')), 1, INSTR(MAX(NVL(v.nome_vendedor, 'Vendedor')) || '(', '(') - 1)) AS nome_vendedor,
        ${buildSignedRevenueSql("f")} AS receita_liquida,
        NVL(f.quantidade_item, 0) AS volume_item,
        f.sk_cliente,
        f.sk_dt_recebimento AS sk_data
      FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
      JOIN DM_VENDAS.DIM_PRODUTOS p
        ON p.sk_produto = f.sk_produto
      LEFT JOIN DM_VENDAS.DIM_VENDEDOR v
        ON v.sk_vendedor = f.sk_vendedor
      WHERE UPPER(TRIM(NVL(p.nome_marca, ''))) = :marca
        AND f.sk_dt_recebimento IS NOT NULL
      GROUP BY
        f.sk_vendedor,
        ${buildSignedRevenueSql("f")},
        NVL(f.quantidade_item, 0),
        f.sk_cliente,
        f.sk_dt_recebimento
    ),
    atual AS (
      SELECT
        sk_vendedor,
        MAX(nome_vendedor) AS nome_vendedor,
        ROUND(SUM(receita_liquida), 2) AS receita_atual,
        ROUND(SUM(volume_item), 2) AS volume_atual,
        COUNT(DISTINCT sk_cliente) AS clientes_atuais
      FROM base
      WHERE sk_data BETWEEN TO_NUMBER(TO_CHAR(:current_start, 'YYYYMMDD'))
                        AND TO_NUMBER(TO_CHAR(:current_end, 'YYYYMMDD'))
      GROUP BY sk_vendedor
    ),
    anterior AS (
      SELECT
        sk_vendedor,
        ROUND(SUM(receita_liquida), 2) AS receita_anterior
      FROM base
      WHERE sk_data BETWEEN TO_NUMBER(TO_CHAR(:previous_start, 'YYYYMMDD'))
                        AND TO_NUMBER(TO_CHAR(:previous_end, 'YYYYMMDD'))
      GROUP BY sk_vendedor
    ),
    atual_ranked AS (
      SELECT
        atual.*,
        DENSE_RANK() OVER (ORDER BY receita_atual DESC) AS posicao_atual
      FROM atual
    ),
    anterior_ranked AS (
      SELECT
        anterior.*,
        DENSE_RANK() OVER (ORDER BY receita_anterior DESC) AS posicao_anterior
      FROM anterior
    )
    SELECT
      a.sk_vendedor,
      a.nome_vendedor,
      a.receita_atual,
      a.volume_atual,
      a.clientes_atuais,
      a.posicao_atual,
      NVL(p.posicao_anterior, a.posicao_atual) AS posicao_anterior
    FROM atual_ranked a
    LEFT JOIN anterior_ranked p
      ON p.sk_vendedor = a.sk_vendedor
    ORDER BY a.posicao_atual
    FETCH FIRST 10 ROWS ONLY
    `,
    {
      marca,
      current_start: window.currentStart,
      current_end: window.currentEnd,
      previous_start: window.previousStart,
      previous_end: window.previousEnd,
    }
  )

  return rows.map((row) => {
    const item = normalizeRow(row)
    const currentPosition = numberValue(item.posicao_atual)
    const previousPosition = numberValue(item.posicao_anterior)

    return {
      skVendedor: item.sk_vendedor ?? null,
      nome: item.nome_vendedor ?? "Vendedor",
      receita: roundCurrency(item.receita_atual),
      volume: roundVolume(item.volume_atual),
      clientes: numberValue(item.clientes_atuais),
      posicaoAtual: currentPosition,
      posicaoAnterior: previousPosition,
      deltaPosicao: previousPosition - currentPosition,
    }
  })
}

async function loadRegionPerformance(marca, window) {
  const rows = await query(
    `
    WITH base AS (
      SELECT
        NVL(c.nome_grupo, 'Carteira sem grupo') AS regiao,
        ${buildSignedRevenueSql("f")} AS receita_liquida,
        f.sk_cliente,
        f.sk_dt_recebimento AS sk_data
      FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
      JOIN DM_VENDAS.DIM_PRODUTOS p
        ON p.sk_produto = f.sk_produto
      LEFT JOIN DM_VENDAS.DIM_CLIENTE c
        ON c.sk_cliente = f.sk_cliente
      WHERE UPPER(TRIM(NVL(p.nome_marca, ''))) = :marca
        AND f.sk_dt_recebimento IS NOT NULL
    )
    SELECT
      regiao,
      ROUND(
        SUM(
          CASE
            WHEN sk_data BETWEEN TO_NUMBER(TO_CHAR(:current_start, 'YYYYMMDD'))
                             AND TO_NUMBER(TO_CHAR(:current_end, 'YYYYMMDD'))
            THEN receita_liquida
            ELSE 0
          END
        ),
        2
      ) AS faturamento_atual,
      ROUND(
        SUM(
          CASE
            WHEN sk_data BETWEEN TO_NUMBER(TO_CHAR(:previous_start, 'YYYYMMDD'))
                             AND TO_NUMBER(TO_CHAR(:previous_end, 'YYYYMMDD'))
            THEN receita_liquida
            ELSE 0
          END
        ),
        2
      ) AS faturamento_anterior,
      COUNT(
        DISTINCT CASE
          WHEN sk_data BETWEEN TO_NUMBER(TO_CHAR(:current_start, 'YYYYMMDD'))
                           AND TO_NUMBER(TO_CHAR(:current_end, 'YYYYMMDD'))
          THEN sk_cliente
        END
      ) AS clientes_atuais
    FROM base
    GROUP BY regiao
    ORDER BY faturamento_atual DESC
    FETCH FIRST 6 ROWS ONLY
    `,
    {
      marca,
      current_start: window.currentStart,
      current_end: window.currentEnd,
      previous_start: window.previousStart,
      previous_end: window.previousEnd,
    }
  )

  const normalized = rows.map((row) => {
    const item = normalizeRow(row)
    return {
      nome: item.regiao ?? "Carteira sem grupo",
      faturamento: roundCurrency(item.faturamento_atual),
      clientes: numberValue(item.clientes_atuais),
      crescimento: calculateGrowth(item.faturamento_atual, item.faturamento_anterior),
    }
  })

  const totalRevenue = normalized.reduce((sum, item) => sum + item.faturamento, 0)

  return normalized.map((item) => ({
    ...item,
    participacao: calculateShare(item.faturamento, totalRevenue),
  }))
}

async function loadBrandTopPerformance(marca, window, itemExpression) {
  const rows = await query(
    `
    SELECT *
    FROM (
      SELECT
        item_nome,
        ROUND(SUM(receita_liquida), 2) AS faturamento_atual,
        ROUND(SUM(volume_item), 2) AS volume_atual
      FROM (
        SELECT
          ${itemExpression} AS item_nome,
          ${buildSignedRevenueSql("f")} AS receita_liquida,
          NVL(f.quantidade_item, 0) AS volume_item,
          f.sk_dt_recebimento AS sk_data
        FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
        JOIN DM_VENDAS.DIM_PRODUTOS p
          ON p.sk_produto = f.sk_produto
        WHERE UPPER(TRIM(NVL(p.nome_marca, ''))) = :marca
          AND f.sk_dt_recebimento IS NOT NULL
      )
      WHERE sk_data BETWEEN TO_NUMBER(TO_CHAR(:current_start, 'YYYYMMDD'))
                        AND TO_NUMBER(TO_CHAR(:current_end, 'YYYYMMDD'))
      GROUP BY item_nome
      ORDER BY faturamento_atual DESC, volume_atual DESC, item_nome
    )
    WHERE ROWNUM <= 5
    `,
    {
      marca,
      current_start: window.currentStart,
      current_end: window.currentEnd,
    }
  )

  return rows.map((row) => {
    const item = normalizeRow(row)
    return {
      nome: item.item_nome ?? "Sem nome",
      faturamento: roundCurrency(item.faturamento_atual),
      volume: roundVolume(item.volume_atual),
    }
  })
}

async function loadBrandTopProducts(marca, window) {
  return loadBrandTopPerformance(marca, window, "NVL(TRIM(p.nome), 'Produto sem nome')")
}

async function loadBrandTopGroups(marca, window) {
  return loadBrandTopPerformance(marca, window, "NVL(TRIM(p.nome_pai_nivel2), 'Grupo sem nome')")
}

async function loadInactiveClientsOpportunity(marca) {
  const rows = await query(
    `
    SELECT *
    FROM (
      SELECT
        NVL(TRIM(c.nome_cliente), 'Cliente sem nome') AS nome_cliente,
        ROUND(SUM(${buildSignedRevenueSql("f")}), 2) AS receita_total,
        MAX(f.sk_dt_recebimento) AS ultima_compra,
        TRUNC(SYSDATE) - TO_DATE(TO_CHAR(MAX(f.sk_dt_recebimento)), 'YYYYMMDD') AS dias_sem_compra
      FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
      JOIN DM_VENDAS.DIM_PRODUTOS p
        ON p.sk_produto = f.sk_produto
      LEFT JOIN DM_VENDAS.DIM_CLIENTE c
        ON c.sk_cliente = f.sk_cliente
      WHERE UPPER(TRIM(NVL(p.nome_marca, ''))) = :marca
        AND f.sk_dt_recebimento IS NOT NULL
      GROUP BY NVL(TRIM(c.nome_cliente), 'Cliente sem nome')
      HAVING MAX(f.sk_dt_recebimento) < TO_NUMBER(TO_CHAR(TRUNC(SYSDATE) - 30, 'YYYYMMDD'))
      ORDER BY dias_sem_compra DESC, receita_total DESC
    )
    WHERE ROWNUM <= 5
    `,
    { marca }
  )

  return rows.map((row) => {
    const item = normalizeRow(row)
    return {
      nome: item.nome_cliente ?? "Cliente sem nome",
      receitaTotal: roundCurrency(item.receita_total),
      ultimaCompra: item.ultima_compra ?? null,
      diasSemCompra: numberValue(item.dias_sem_compra),
    }
  })
}

function buildIndustryInsights({ marca, ranking, regions, inactiveClients, campaign, summary }) {
  const insights = []
  const topGrowthRegion = [...regions].sort((a, b) => b.crescimento - a.crescimento)[0]
  const topSeller = ranking[0]

  if (topGrowthRegion && topGrowthRegion.faturamento > 0) {
    insights.push({
      kind: "momentum",
      title: `${topGrowthRegion.nome} puxou o ciclo`,
      description: `${topGrowthRegion.nome} cresceu ${topGrowthRegion.crescimento}% e concentrou ${topGrowthRegion.participacao}% do faturamento da marca neste periodo.`,
    })
  }

  if (summary.top3Share > 0) {
    insights.push({
      kind: "focus",
      title: "Top 3 concentrando resultado",
      description: `Os 3 vendedores lideres ja representam ${summary.top3Share}% das vendas de ${marca}, um sinal claro de onde acelerar coaching e replicacao.`,
    })
  }

  if (inactiveClients.length > 0) {
    insights.push({
      kind: "opportunity",
      title: "Carteira com retomada facil",
      description: `${inactiveClients.length} clientes relevantes estao ha mais de 30 dias sem comprar. Oportunidade imediata em ${inactiveClients[0].nome}.`,
    })
  }

  if (topSeller) {
    insights.push({
      kind: "leader",
      title: `${topSeller.nome} lidera a campanha`,
      description: `${topSeller.nome} abriu o ranking da marca com ${topSeller.clientes} clientes impactados e ${topSeller.volume} em volume vendido no periodo.`,
    })
  }

  if (campaign.percent >= 80) {
    insights.push({
      kind: "campaign",
      title: "Campanha em reta final",
      description: `${campaign.title} ja esta em ${campaign.percent}% da meta. Vale reforcar as lojas mais quentes para fechar o ciclo acima do previsto.`,
    })
  }

  return insights.slice(0, 4)
}

router.post("/login-industria", async (req, res) => {
  const codigo = textValue(req.body?.codigo)
  const senha = textValue(req.body?.senha)

  if (!codigo || !senha) {
    return res.status(400).json({ error: "Codigo e senha sao obrigatorios." })
  }

  try {
    await ensureFornecedorTableReady()

    const rows = await query(
      `
      SELECT *
      FROM (
        SELECT
          id,
          nome,
          codigo,
          senha_hash,
          marca,
          ativo
        FROM fornecedores_login
        WHERE UPPER(TRIM(codigo)) = :codigo
      )
      WHERE ROWNUM = 1
      `,
      { codigo: normalizeBrand(codigo) }
    )

    if (!rows.length) {
      return res.status(401).json({ error: "Codigo ou senha invalidos." })
    }

    const fornecedor = normalizeRow(rows[0])

    if (String(fornecedor.ativo ?? "N").toUpperCase() !== "S") {
      return res.status(403).json({ error: "Fornecedor inativo." })
    }

    const senhaOk = await bcrypt.compare(senha, String(fornecedor.senha_hash ?? ""))

    if (!senhaOk) {
      return res.status(401).json({ error: "Codigo ou senha invalidos." })
    }

    return res.json({
      id_usuario: fornecedor.id,
      nome: fornecedor.nome,
      login: fornecedor.codigo,
      role: "INDUSTRIA",
      marca: fornecedor.marca,
      foto_url: null,
      senha_temporaria: "N",
    })
  } catch (err) {
    console.error("Erro no login da industria:", err)

    if (err?.status === 503) {
      return res.status(503).json({
        error: err.message,
        details: err.details,
      })
    }

    return res.status(500).json({ error: "Erro interno no servidor." })
  }
})

router.get("/industria/dashboard", async (req, res) => {
  const marca = normalizeBrand(req.query?.marca)

  if (!marca) {
    return res.status(400).json({ error: "Informe a marca do parceiro." })
  }

  try {
    const window = getMonthComparisonWindow(new Date())
    const [summaryRow, ranking, regions, inactiveClients, topProducts, topGroups, challengeSummary] = await Promise.all([
      loadBrandSummary(marca, window),
      loadBrandRanking(marca, window),
      loadRegionPerformance(marca, window),
      loadInactiveClientsOpportunity(marca),
      loadBrandTopProducts(marca, window),
      loadBrandTopGroups(marca, window),
      loadBrandChallengeSummary(marca),
    ])

    const faturamentoAtual = roundCurrency(summaryRow.faturamento_atual)
    const faturamentoAnterior = roundCurrency(summaryRow.faturamento_anterior)
    const volumeAtual = roundVolume(summaryRow.volume_atual)
    const volumeAnterior = roundVolume(summaryRow.volume_anterior)
    const clientesImpactados = numberValue(summaryRow.clientes_impactados)
    const vendedoresImpactados = numberValue(summaryRow.vendedores_impactados)
    const crescimentoVsAnterior = calculateGrowth(faturamentoAtual, faturamentoAnterior)
    const campaign =
      challengeSummary ??
      buildFallbackCampaignSummary(marca, faturamentoAtual, faturamentoAnterior, vendedoresImpactados)
    const totalRankingRevenue = ranking.reduce((sum, item) => sum + item.receita, 0)
    const top3Share = calculateShare(
      ranking.slice(0, 3).reduce((sum, item) => sum + item.receita, 0),
      totalRankingRevenue
    )

    const summary = {
      top3Share,
      inactiveClients: inactiveClients.length,
      bestRegion: regions[0]?.nome ?? null,
    }

    const insights = buildIndustryInsights({
      marca,
      ranking,
      regions,
      inactiveClients,
      campaign,
      summary,
    })

    return res.json({
      marca,
      generatedAt: new Date().toISOString(),
      reference: {
        currentLabel: formatRangeLabel(window.currentStart, window.currentEnd),
        previousLabel: formatRangeLabel(window.previousStart, window.previousEnd),
      },
      hero: {
        headline: "Sua campanha em acao dentro das lojas",
        subheadline: "Acompanhe o impacto da sua marca em tempo real e entre na operacao como parceiro ativo.",
      },
      campaign,
      kpis: {
        faturamentoAtual,
        faturamentoAnterior,
        volumeAtual,
        volumeAnterior,
        percentualMeta: Number(campaign.percent.toFixed(1)),
        clientesImpactados,
        vendedoresImpactados: Math.max(vendedoresImpactados, numberValue(campaign.sellersImpacted)),
        crescimentoVsAnterior,
      },
      impact: {
        vendasGeradas: faturamentoAtual,
        volumeVendido: volumeAtual,
        vendedoresImpactados: Math.max(vendedoresImpactados, numberValue(campaign.sellersImpacted)),
      },
      ranking,
      regions,
      inactiveClients,
      topProducts,
      topGroups,
      summary,
      insights,
    })
  } catch (err) {
    console.error("Erro ao montar dashboard da industria:", err)
    return res.status(500).json({ error: "Erro ao buscar dados da industria." })
  }
})

export default router

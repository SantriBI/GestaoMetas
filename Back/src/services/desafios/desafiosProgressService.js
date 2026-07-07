import { queryWithDesafiosDbContext as query } from "./desafiosDbContext.js"

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

function getCurrentMonthWindow() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)
  return { dataInicio: start, dataFim: end }
}

function resolveMetricWindow(challenge) {
  const dataInicio = normalizeChallengeDate(challenge?.dataInicio, "start")
  const dataFim = normalizeChallengeDate(challenge?.dataFim, "end")

  if (challenge?.exigeAceite === false) {
    const hasEnded = dataFim && dataFim.getTime() < Date.now()
    if (hasEnded) {
      return { dataInicio, dataFim }
    }
    return getCurrentMonthWindow()
  }

  return { dataInicio, dataFim }
}

function signedRevenueSql(alias = "f") {
  return `
    CASE
      WHEN ${alias}.tipo = 'DEV' THEN NVL(${alias}.valor_liquido_item, 0) * -1
      ELSE NVL(${alias}.valor_liquido_item, 0)
    END
  `
}

function buildDateFilter() {
  return `
    f.sk_dt_recebimento >= TO_NUMBER(TO_CHAR(:janela_inicio, 'YYYYMMDD'))
    AND f.sk_dt_recebimento <= TO_NUMBER(TO_CHAR(:janela_fim, 'YYYYMMDD'))
  `
}

async function runMetric(sql, binds) {
  const rows = await query(sql, binds)
  const row = normalizeRow(rows[0] ?? {})
  return numberValue(row.valor ?? row.total ?? row.quantidade ?? 0)
}

async function faturamento(meta, participant, challenge) {
  const window = resolveMetricWindow(challenge)
  const isQuantidade = String(meta.metricType ?? 'VALOR').toUpperCase() === 'QUANTIDADE'
  const metricExpr = isQuantidade
    ? 'NVL(SUM(f.quantidade_item), 0)'
    : `ROUND(NVL(SUM(${signedRevenueSql("f")}), 0), 2)`
  return runMetric(
    `
    SELECT ${metricExpr} AS valor
    FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
    WHERE f.sk_vendedor = :sk_vendedor
      AND ${buildDateFilter()}
    `,
    { sk_vendedor: participant.skVendedor, janela_inicio: window.dataInicio, janela_fim: window.dataFim }
  )
}

async function pedidosFechados(meta, participant, challenge) {
  const window = resolveMetricWindow(challenge)
  return runMetric(
    `
    SELECT COUNT(DISTINCT f.orcamento_id) AS valor
    FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
    WHERE f.sk_vendedor = :sk_vendedor
      AND ${buildDateFilter()}
    `,
    { sk_vendedor: participant.skVendedor, janela_inicio: window.dataInicio, janela_fim: window.dataFim }
  )
}

async function clientesAtendidos(meta, participant, challenge) {
  const window = resolveMetricWindow(challenge)
  return runMetric(
    `
    SELECT COUNT(DISTINCT f.sk_cliente) AS valor
    FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
    WHERE f.sk_vendedor = :sk_vendedor
      AND ${buildDateFilter()}
    `,
    { sk_vendedor: participant.skVendedor, janela_inicio: window.dataInicio, janela_fim: window.dataFim }
  )
}

async function recuperarClientes(meta, participant, challenge) {
  const window = resolveMetricWindow(challenge)
  const challengeStart = new Date(window.dataInicio)
  const inactiveWindowStart = new Date(challengeStart.getTime() - 30 * 24 * 60 * 60 * 1000)

  return runMetric(
    `
    SELECT COUNT(DISTINCT vendas_periodo.sk_cliente) AS valor
    FROM (
      SELECT DISTINCT f.sk_cliente
      FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
      WHERE f.sk_vendedor = :sk_vendedor
        AND ${buildDateFilter()}
    ) vendas_periodo
    WHERE NOT EXISTS (
      SELECT 1
      FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE hist
      WHERE hist.sk_vendedor = :sk_vendedor
        AND hist.sk_cliente = vendas_periodo.sk_cliente
        AND hist.sk_dt_recebimento BETWEEN TO_NUMBER(TO_CHAR(:janela_inatividade_inicio, 'YYYYMMDD'))
        AND TO_NUMBER(TO_CHAR(:janela_inicio - 1, 'YYYYMMDD'))
    )
    `,
    {
      sk_vendedor: participant.skVendedor,
      janela_inicio: window.dataInicio,
      janela_fim: window.dataFim,
      janela_inatividade_inicio: inactiveWindowStart,
    }
  )
}

async function produtoOuMarca(meta, participant, challenge) {
  const window = resolveMetricWindow(challenge)
  const config = meta.config ?? {}
  const productId = textValue(config.productId)
  const brandId = textValue(config.brandId)
  const targetType = String(config.targetType ?? "brand").toUpperCase()
  const targetValue = textValue(config.targetValue)
  let predicate = "1 = 1"

  if (!productId && !brandId && !targetValue) {
    return 0
  }

  if (productId && brandId) {
    predicate = "(TO_CHAR(p.produto_id) = :product_id OR TO_CHAR(p.marca_id) = :brand_id)"
  } else if (productId) {
    predicate = "TO_CHAR(p.produto_id) = :product_id"
  } else if (brandId) {
    predicate = "TO_CHAR(p.marca_id) = :brand_id"
  } else if (targetValue) {
    const predicates = {
      BRAND: "UPPER(TRIM(p.nome_marca)) = UPPER(TRIM(:target_value))",
      CATEGORY: "UPPER(TRIM(p.nome_pai_nivel1)) = UPPER(TRIM(:target_value))",
      PRODUCT: "(UPPER(TRIM(p.nome)) = UPPER(TRIM(:target_value)) OR TO_CHAR(p.produto_id) = :target_value)",
    }

    predicate = predicates[targetType] ?? predicates.BRAND
  }

  const isQuantidade = String(meta.metricType ?? 'VALOR').toUpperCase() === 'QUANTIDADE'
  const valueExpr = isQuantidade
    ? 'NVL(SUM(f.quantidade_item), 0)'
    : `ROUND(NVL(SUM(${signedRevenueSql("f")}), 0), 2)`

  const binds = {
    sk_vendedor: participant.skVendedor,
    janela_inicio: window.dataInicio,
    janela_fim: window.dataFim,
  }

  if (productId && brandId) {
    binds.product_id = productId
    binds.brand_id = brandId
  } else if (productId) {
    binds.product_id = productId
  } else if (brandId) {
    binds.brand_id = brandId
  } else if (targetValue) {
    binds.target_value = targetValue
  }

  return runMetric(
    `
    SELECT ${valueExpr} AS valor
    FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
    JOIN DM_VENDAS.DIM_PRODUTOS p
      ON p.sk_produto = f.sk_produto
    WHERE f.sk_vendedor = :sk_vendedor
      AND ${buildDateFilter()}
      AND ${predicate}
    `,
    binds
  )
}

const resolvers = {
  FATURAMENTO: faturamento,
  PEDIDOS_FECHADOS: pedidosFechados,
  CLIENTES_ATENDIDOS: clientesAtendidos,
  RECUPERAR_CLIENTES: recuperarClientes,
  PRODUTO_OU_MARCA: produtoOuMarca,
}

export async function calculateMetaProgress(meta, participant, challenge) {
  const resolver = resolvers[meta.tipoMeta] ?? faturamento
  const progressoAtual = await resolver(meta, participant, challenge)
  const percentualConclusao = meta.metaValor > 0
    ? Number(Math.min((progressoAtual / meta.metaValor) * 100, 100).toFixed(2))
    : 0
  const multiplier = meta.metaValor > 0
    ? Math.floor(progressoAtual / meta.metaValor)
    : 0
  const concluido = multiplier >= 1
  const premioValor = multiplier * numberValue(meta.recompensaValor)

  return {
    progressoAtual,
    percentualConclusao,
    premioValor,
    multiplier,
    concluido,
    concluidoEm: concluido ? new Date() : null,
  }
}

export async function calculateParticipantProgress(challenge, metas, participant) {
  const metaProgress = await Promise.all(
    metas.map(async (meta) => {
      const progress = await calculateMetaProgress(meta, participant, challenge)
      return { ...meta, progress }
    })
  )

  const completedMetas = metaProgress.filter((item) => item.progress.concluido).length
  const progressAverage = metaProgress.length
    ? Number((metaProgress.reduce((sum, item) => sum + item.progress.percentualConclusao, 0) / metaProgress.length).toFixed(2))
    : 0
  const totalReward = metaProgress.reduce((sum, item) => sum + numberValue(item.progress.premioValor), 0)
  const hasAccepted = !!participant.aceitoEm
  const hasProgress = metaProgress.some((item) => item.progress.progressoAtual > 0)
  const requiresAcceptance = challenge.exigeAceite !== false
  const previousStatus = String(participant.statusParticipacao ?? "").toUpperCase()
  const challengeEnd = normalizeChallengeDate(challenge?.dataFim, "end")

  let statusParticipacao = participant.statusParticipacao ?? (challenge.exigeAceite ? "DISPONIVEL" : "CONVIDADO")
  if (completedMetas === metaProgress.length && metaProgress.length > 0 && (!requiresAcceptance || hasAccepted)) {
    statusParticipacao = "CONCLUIDO"
  } else if ((!requiresAcceptance || hasAccepted) && hasProgress) {
    statusParticipacao = "EM_ANDAMENTO"
  } else if (hasAccepted) {
    statusParticipacao = "ACEITO"
  } else if (previousStatus === "RECUSADO") {
    statusParticipacao = "RECUSADO"
  } else {
    statusParticipacao = requiresAcceptance ? "DISPONIVEL" : "CONVIDADO"
  }

  if (challengeEnd && challengeEnd.getTime() < Date.now() && statusParticipacao !== "CONCLUIDO") {
    statusParticipacao = "EXPIRADO"
  }

  return {
    participant: {
      ...participant,
      statusParticipacao,
      premioTotalLiberado: Number(totalReward.toFixed(2)),
      concluidoEm: statusParticipacao === "CONCLUIDO" ? participant.concluidoEm ?? new Date() : null,
    },
    metas: metaProgress,
    resumo: {
      totalMetas: metaProgress.length,
      metasConcluidas: completedMetas,
      percentualGeral: progressAverage,
      premioTotalLiberado: Number(totalReward.toFixed(2)),
    },
  }
}

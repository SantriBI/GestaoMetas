import { queryWithDesafiosDbContext as query } from "./desafiosDbContext.js"

function numberValue(value) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeRow(row) {
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
}

function roundCurrency(value) {
  return Number(numberValue(value).toFixed(2))
}

function roundPercent(value) {
  return Number(numberValue(value).toFixed(2))
}

function buildRatio(numerator, denominator) {
  if (!numberValue(denominator)) return 0
  return roundPercent(numberValue(numerator) / numberValue(denominator))
}

function getMetaType(meta) {
  return String(meta?.tipoMeta ?? "").toUpperCase()
}

function getMetaKey(meta) {
  const type = getMetaType(meta)
  if (type !== "PRODUTO_OU_MARCA") return type

  const config = meta?.config ?? {}
  const productKey = String(config.productId ?? config.productName ?? "").trim().toUpperCase() || "ALL"
  const brandKey = String(config.brandId ?? config.brandName ?? "").trim().toUpperCase() || "ALL"
  const targetType = String(config.targetType ?? "brand").trim().toUpperCase() || "BRAND"
  const targetValue = String(config.targetValue ?? "").trim().toUpperCase() || "ALL"
  return `${type}:PRODUCT:${productKey}:BRAND:${brandKey}:LEGACY:${targetType}:${targetValue}`
}

function groupPotentialMetas(metas) {
  const grouped = new Map()

  for (const meta of metas ?? []) {
    const key = getMetaKey(meta)
    const currentValue = numberValue(meta?.metaValor)
    const existing = grouped.get(key)

    if (!existing || currentValue > existing.metaValor) {
      grouped.set(key, {
        key,
        type: getMetaType(meta),
        metaValor: currentValue,
      })
    }
  }

  return Array.from(grouped.values())
}

function aggregatePotentialOperations(metas, eligibleParticipants) {
  const participantCount = numberValue(eligibleParticipants)
  const grouped = groupPotentialMetas(metas)

  let directRevenuePotential = 0
  let ordersPotential = 0
  let clientsPotential = 0
  let recoveredClientsPotential = 0

  for (const meta of grouped) {
    const projectedValue = numberValue(meta.metaValor) * participantCount

    if (meta.type === "FATURAMENTO" || meta.type === "PRODUTO_OU_MARCA") {
      directRevenuePotential += projectedValue
      continue
    }

    if (meta.type === "PEDIDOS_FECHADOS") {
      ordersPotential += projectedValue
      continue
    }

    if (meta.type === "CLIENTES_ATENDIDOS") {
      clientsPotential += projectedValue
      continue
    }

    if (meta.type === "RECUPERAR_CLIENTES") {
      recoveredClientsPotential += projectedValue
    }
  }

  return {
    directRevenuePotential: roundCurrency(directRevenuePotential),
    ordersPotential: roundCurrency(ordersPotential),
    clientsPotential: roundCurrency(clientsPotential),
    recoveredClientsPotential: roundCurrency(recoveredClientsPotential),
  }
}

function aggregateRealizedOperations(participantsDetailed) {
  let directRevenueReal = 0
  let ordersReal = 0
  let clientsReal = 0
  let recoveredClientsReal = 0

  for (const participantDetail of participantsDetailed ?? []) {
    const grouped = new Map()

    for (const meta of participantDetail?.metas ?? []) {
      const key = getMetaKey(meta)
      const progressValue = numberValue(meta?.progress?.progressoAtual ?? meta?.progressoAtual)
      const existing = grouped.get(key)

      if (!existing || progressValue > existing.progressValue) {
        grouped.set(key, {
          type: getMetaType(meta),
          progressValue,
        })
      }
    }

    for (const meta of grouped.values()) {
      if (meta.type === "FATURAMENTO" || meta.type === "PRODUTO_OU_MARCA") {
        directRevenueReal += meta.progressValue
        continue
      }

      if (meta.type === "PEDIDOS_FECHADOS") {
        ordersReal += meta.progressValue
        continue
      }

      if (meta.type === "CLIENTES_ATENDIDOS") {
        clientsReal += meta.progressValue
        continue
      }

      if (meta.type === "RECUPERAR_CLIENTES") {
        recoveredClientsReal += meta.progressValue
      }
    }
  }

  return {
    directRevenueReal: roundCurrency(directRevenueReal),
    ordersReal: roundCurrency(ordersReal),
    clientsReal: roundCurrency(clientsReal),
    recoveredClientsReal: roundCurrency(recoveredClientsReal),
  }
}

async function loadSellerBaseline(targetSellers) {
  const sellerIds = Array.from(
    new Set(
      (targetSellers ?? [])
        .map((seller) => Number(seller?.skVendedor))
        .filter((sellerId) => Number.isFinite(sellerId) && sellerId > 0)
    )
  )

  if (!sellerIds.length) {
    return {
      windowDays: 30,
      revenueTotal: 0,
      ordersTotal: 0,
      clientsTotal: 0,
      avgTicket: 350,
      avgRevenuePerClient: 280,
    }
  }

  const sellerList = sellerIds.join(",")
  const rows = await query(
    `
    WITH base AS (
      SELECT
        CASE
          WHEN f.tipo = 'DEV' THEN NVL(f.valor_liquido_item, 0) * -1
          ELSE NVL(f.valor_liquido_item, 0)
        END AS receita_item,
        f.orcamento_id,
        f.sk_cliente
      FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE f
      WHERE f.sk_vendedor IN (${sellerList})
        AND f.sk_dt_recebimento BETWEEN TO_NUMBER(TO_CHAR(TRUNC(SYSDATE) - 30, 'YYYYMMDD'))
        AND TO_NUMBER(TO_CHAR(TRUNC(SYSDATE), 'YYYYMMDD'))
    )
    SELECT
      ROUND(NVL(SUM(receita_item), 0), 2) AS receita_total,
      COUNT(DISTINCT orcamento_id) AS pedidos_total,
      COUNT(DISTINCT sk_cliente) AS clientes_total
    FROM base
    `
  )

  const row = normalizeRow(rows[0] ?? {})
  const revenueTotal = roundCurrency(row.receita_total)
  const ordersTotal = numberValue(row.pedidos_total)
  const clientsTotal = numberValue(row.clientes_total)
  const avgTicket = ordersTotal > 0 ? revenueTotal / ordersTotal : 0
  const avgRevenuePerClient = clientsTotal > 0 ? revenueTotal / clientsTotal : 0

  return {
    windowDays: 30,
    revenueTotal,
    ordersTotal,
    clientsTotal,
    avgTicket: roundCurrency(avgTicket || avgRevenuePerClient || 350),
    avgRevenuePerClient: roundCurrency(avgRevenuePerClient || avgTicket || 280),
  }
}

function resolveRevenueProjection({ directRevenue, orders, clients, recoveredClients, baseline }) {
  if (numberValue(directRevenue) > 0) {
    return {
      estimatedRevenue: roundCurrency(directRevenue),
      basis: "META_DIRETA",
    }
  }

  const orderEstimate = numberValue(orders) * numberValue(baseline?.avgTicket)
  const clientEstimate = numberValue(clients) * numberValue(baseline?.avgRevenuePerClient)
  const recoveredEstimate = numberValue(recoveredClients) * numberValue(baseline?.avgRevenuePerClient)
  const inferredRevenue = Math.max(orderEstimate, clientEstimate, recoveredEstimate)

  return {
    estimatedRevenue: roundCurrency(inferredRevenue),
    basis: inferredRevenue === orderEstimate
      ? "PEDIDOS_E_TICKET_MEDIO"
      : inferredRevenue === recoveredEstimate
        ? "RECUPERACAO_E_RECEITA_MEDIA_POR_CLIENTE"
        : "CLIENTES_E_RECEITA_MEDIA_POR_CLIENTE",
  }
}

function summarizeParticipantState(participantsDetailed) {
  const eligibleParticipants = (participantsDetailed ?? []).length
  const acceptedParticipants = (participantsDetailed ?? []).filter((item) =>
    ["ACEITO", "EM_ANDAMENTO", "CONCLUIDO"].includes(String(item?.participant?.statusParticipacao ?? ""))
  ).length
  const completedParticipants = (participantsDetailed ?? []).filter((item) =>
    String(item?.participant?.statusParticipacao ?? "") === "CONCLUIDO"
  ).length
  const bonusPaid = (participantsDetailed ?? []).reduce(
    (sum, item) => sum + numberValue(item?.participant?.premioTotalLiberado),
    0
  )

  return {
    eligibleParticipants,
    acceptedParticipants,
    completedParticipants,
    bonusPaid: roundCurrency(bonusPaid),
  }
}

function computeBonusPotential(metas, eligibleParticipants, potentialOperations) {
  const participantCount = numberValue(eligibleParticipants)
  return roundCurrency(
    (metas ?? []).reduce((sum, meta) => {
      const metaValor = numberValue(meta?.metaValor)
      const recompensa = numberValue(meta?.recompensaValor)
      const perParticipantRevenue = participantCount > 0
        ? numberValue(potentialOperations?.directRevenuePotential) / participantCount
        : metaValor
      const multiplierEstimate = metaValor > 0
        ? Math.max(1, Math.floor(perParticipantRevenue / metaValor))
        : 1
      return sum + recompensa * multiplierEstimate
    }, 0) * participantCount
  )
}

function buildImpactPayload({
  metas,
  eligibleParticipants,
  acceptedParticipants = 0,
  completedParticipants = 0,
  bonusPaid = 0,
  potentialOperations,
  realizedOperations,
  baseline,
}) {
  const bonusPotential = computeBonusPotential(metas, eligibleParticipants, potentialOperations)

  const potentialRevenue = resolveRevenueProjection({
    directRevenue: potentialOperations.directRevenuePotential,
    orders: potentialOperations.ordersPotential,
    clients: potentialOperations.clientsPotential,
    recoveredClients: potentialOperations.recoveredClientsPotential,
    baseline,
  })

  const realizedRevenue = resolveRevenueProjection({
    directRevenue: realizedOperations.directRevenueReal,
    orders: realizedOperations.ordersReal,
    clients: realizedOperations.clientsReal,
    recoveredClients: realizedOperations.recoveredClientsReal,
    baseline,
  })

  const estimatedRevenue = potentialRevenue.estimatedRevenue
  const realizedRevenueCurrent = realizedRevenue.estimatedRevenue

  return {
    eligibleParticipants: numberValue(eligibleParticipants),
    acceptedParticipants: numberValue(acceptedParticipants),
    completedParticipants: numberValue(completedParticipants),
    bonusPotential,
    bonusPaid: roundCurrency(bonusPaid),
    bonusRemainingPotential: roundCurrency(Math.max(bonusPotential - numberValue(bonusPaid), 0)),
    estimatedRevenue,
    realizedRevenue: realizedRevenueCurrent,
    estimatedOrders: roundCurrency(potentialOperations.ordersPotential),
    realizedOrders: roundCurrency(realizedOperations.ordersReal),
    estimatedClients: roundCurrency(potentialOperations.clientsPotential),
    realizedClients: roundCurrency(realizedOperations.clientsReal),
    estimatedRecoveredClients: roundCurrency(potentialOperations.recoveredClientsPotential),
    realizedRecoveredClients: roundCurrency(realizedOperations.recoveredClientsReal),
    returnPerBonusPotential: buildRatio(estimatedRevenue, bonusPotential),
    returnPerBonusRealized: buildRatio(realizedRevenueCurrent, bonusPaid),
    costPercentPotential: buildRatio(bonusPotential, estimatedRevenue) * 100,
    costPercentRealized: buildRatio(numberValue(bonusPaid), realizedRevenueCurrent) * 100,
    revenueCaptureRate: buildRatio(realizedRevenueCurrent, estimatedRevenue) * 100,
    bonusBurnRate: buildRatio(numberValue(bonusPaid), bonusPotential) * 100,
    estimationBasis: potentialRevenue.basis,
    realizationBasis: realizedRevenue.basis,
    referenceTicketMedio: roundCurrency(baseline.avgTicket),
    referenceReceitaPorCliente: roundCurrency(baseline.avgRevenuePerClient),
    referenceWindowDays: numberValue(baseline.windowDays),
    generatedAt: new Date().toISOString(),
  }
}

export async function calculateDraftChallengeImpact(payload, targetSellers) {
  const eligibleParticipants = (targetSellers ?? []).length
  const baseline = await loadSellerBaseline(targetSellers)
  const potentialOperations = aggregatePotentialOperations(payload?.metas ?? [], eligibleParticipants)

  return buildImpactPayload({
    metas: payload?.metas ?? [],
    eligibleParticipants,
    potentialOperations,
    realizedOperations: {
      directRevenueReal: 0,
      ordersReal: 0,
      clientsReal: 0,
      recoveredClientsReal: 0,
    },
    baseline,
  })
}

// Versao rapida usada em listChallenges(): so multiplica metaValor/recompensaValor
// e soma premioTotalLiberado ja calculado por calculateParticipantProgress.
// Nao dispara loadSellerBaseline (query pesada em FATO_VENDAS_LUCRATIVIDADE),
// entao nao preenche estimatedRevenue/realizedRevenue (use calculateChallengeImpact
// para isso, na tela de detalhe de uma campanha).
export function calculateBonusSummary({ metas, participantsDetailed }) {
  const participantSummary = summarizeParticipantState(participantsDetailed)
  const potentialOperations = aggregatePotentialOperations(metas ?? [], participantSummary.eligibleParticipants)
  const bonusPotential = computeBonusPotential(metas, participantSummary.eligibleParticipants, potentialOperations)
  const bonusPaid = participantSummary.bonusPaid

  return {
    eligibleParticipants: participantSummary.eligibleParticipants,
    acceptedParticipants: participantSummary.acceptedParticipants,
    completedParticipants: participantSummary.completedParticipants,
    bonusPotential,
    bonusPaid,
    bonusRemainingPotential: roundCurrency(Math.max(bonusPotential - bonusPaid, 0)),
    estimatedRevenue: 0,
    realizedRevenue: 0,
    estimatedOrders: 0,
    realizedOrders: 0,
    estimatedClients: 0,
    realizedClients: 0,
    estimatedRecoveredClients: 0,
    realizedRecoveredClients: 0,
    returnPerBonusPotential: 0,
    returnPerBonusRealized: 0,
    costPercentPotential: 0,
    costPercentRealized: 0,
    revenueCaptureRate: 0,
    bonusBurnRate: bonusPotential > 0 ? roundPercent((bonusPaid / bonusPotential) * 100) : 0,
    estimationBasis: "NAO_CALCULADO_NA_LISTAGEM",
    realizationBasis: "NAO_CALCULADO_NA_LISTAGEM",
    referenceTicketMedio: 0,
    referenceReceitaPorCliente: 0,
    referenceWindowDays: 0,
    generatedAt: new Date().toISOString(),
  }
}

export async function calculateChallengeImpact({ metas, participantsDetailed }) {
  const participantSummary = summarizeParticipantState(participantsDetailed)
  const eligibleSellers = (participantsDetailed ?? []).map((item) => ({
    skVendedor: item?.participant?.skVendedor,
  }))
  const baseline = await loadSellerBaseline(eligibleSellers)
  const potentialOperations = aggregatePotentialOperations(metas ?? [], participantSummary.eligibleParticipants)
  const realizedOperations = aggregateRealizedOperations(participantsDetailed)

  return buildImpactPayload({
    metas,
    eligibleParticipants: participantSummary.eligibleParticipants,
    acceptedParticipants: participantSummary.acceptedParticipants,
    completedParticipants: participantSummary.completedParticipants,
    bonusPaid: participantSummary.bonusPaid,
    potentialOperations,
    realizedOperations,
    baseline,
  })
}

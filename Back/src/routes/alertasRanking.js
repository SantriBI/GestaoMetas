import express from "express"
import { queryOracleByEmpresaId } from "../db/oracle-tenants.js"
import { requireAuth } from "../middleware/auth.js"
import { getScopedEmpresaId } from "../services/requestScope.js"
import {
  buildSellerInCondition,
  getAllowedSellerCodesByEmpresaId,
  isSellerAllowed,
} from "../services/tenantSellerScope.js"

const router = express.Router()

function formatMoneyBR(value) {
  const n = Number(value || 0)
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDateISO(dateValue) {
  if (!dateValue) return null
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function formatPosicoes(n) {
  return n === 1 ? "posição" : "posições"
}

function getPercMetaDia(row) {
  const receita = Number(row?.RECEITA_DIA || 0)
  const meta = Number(row?.META_DIA || 0)
  if (meta <= 0) return 0
  return (receita / meta) * 100
}

function formatPercentBR(value) {
  const n = Number(value || 0)
  return `${n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`
}

async function getQueryContext(empresaId) {
  return {
    query: (sql, binds = {}, options = {}) => queryOracleByEmpresaId(empresaId, sql, binds, options),
    rankingDayHistView: "VW_RANKING_VENDEDORES_DIA_HIST",
  }
}

async function loadHistorico(context) {
  const sellerScope = buildSellerInCondition("SK_VENDEDOR", context.allowedSellerCodes, "hist_seller")
  const bindsBase = sellerScope.binds

  const refs = await context.query(
    `
      SELECT DATA_REF
      FROM (
        SELECT DISTINCT DATA_REF
        FROM ${context.rankingDayHistView}
        WHERE ${sellerScope.clause}
      ORDER BY DATA_REF DESC
    )
    WHERE ROWNUM <= 2
    `,
    bindsBase
  )

  if (!refs.length) {
    return { refs: [], hoje: [], ontem: [] }
  }

  const dataHoje = refs[0].DATA_REF
  const dataOntem = refs[1]?.DATA_REF || null

  const hoje = await context.query(
    `
    SELECT
      DATA_REF,
      SK_EMPRESA,
      SK_VENDEDOR,
      NOME_VENDEDOR,
      RECEITA_DIA,
      RANKING_DIA
    FROM ${context.rankingDayHistView}
    WHERE DATA_REF = :dataHoje
      AND ${sellerScope.clause}
    `,
    { ...bindsBase, dataHoje }
  )

  const ontem = dataOntem
    ? await context.query(
        `
        SELECT
          DATA_REF,
          SK_EMPRESA,
          SK_VENDEDOR,
          NOME_VENDEDOR,
          RECEITA_DIA,
          RANKING_DIA
        FROM ${context.rankingDayHistView}
        WHERE DATA_REF = :dataOntem
          AND ${sellerScope.clause}
        `,
        { ...bindsBase, dataOntem }
      )
    : []

  return { refs, hoje, ontem }
}

router.get("/alertas-ranking", requireAuth, async (req, res) => {
  try {
    const empresaId = getScopedEmpresaId(req)
    if (!empresaId) {
      return res.status(400).json({ error: "empresa_id e obrigatorio para gerar alertas de ranking." })
    }

    const role = String(req.auth?.role ?? "").toUpperCase()
    const requestedSkVendedor = req.query.sk_vendedor ? Number(req.query.sk_vendedor) : null
    const skVendedor = role === "VENDEDOR"
      ? Number(req.auth?.sk_vendedor ?? 0) || null
      : requestedSkVendedor

    if (role === "VENDEDOR" && requestedSkVendedor && String(requestedSkVendedor) !== String(req.auth?.sk_vendedor ?? "")) {
      return res.status(403).json({ error: "Acesso permitido apenas aos alertas do vendedor autenticado." })
    }

    const context = await getQueryContext(empresaId)
    context.allowedSellerCodes = await getAllowedSellerCodesByEmpresaId(empresaId)
    if (skVendedor && !isSellerAllowed(context.allowedSellerCodes, skVendedor)) {
      return res.status(403).json({ error: "Vendedor fora da organizacao autenticada." })
    }
    const historico = await loadHistorico(context)
    const { refs, hoje, ontem } = historico

    if (!refs.length || !hoje.length) {
      return res.json({
        referencia: { hoje: null, ontem: null },
        alertasGerente: [],
        alertasVendedor: [],
      })
    }

    const dataHoje = refs[0].DATA_REF
    const dataOntem = refs[1]?.DATA_REF || null

    const mapHoje = new Map(hoje.map((r) => [Number(r.SK_VENDEDOR), r]))
    const mapOntem = new Map(ontem.map((r) => [Number(r.SK_VENDEDOR), r]))
    const hojeOrdenado = [...hoje].sort(
      (a, b) => Number(a.RANKING_DIA) - Number(b.RANKING_DIA)
    )
    const hojeOrdenadoPorPercMeta = [...hoje].sort(
      (a, b) => getPercMetaDia(b) - getPercMetaDia(a)
    )

    const movimentos = []
    for (const rHoje of hoje) {
      const sk = Number(rHoje.SK_VENDEDOR)
      const rOntem = mapOntem.get(sk)
      if (!rOntem) continue

      const rankHoje = Number(rHoje.RANKING_DIA)
      const rankOntem = Number(rOntem.RANKING_DIA)
      const delta = rankOntem - rankHoje

      if (delta !== 0) {
        movimentos.push({ nome: rHoje.NOME_VENDEDOR, delta })
      }
    }
    movimentos.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

    const alertasGerente = []
    const lider = hojeOrdenadoPorPercMeta[0]
    const liderPerc = getPercMetaDia(lider)

    if (lider) {
      alertasGerente.push({
        tipo: "lider_dia",
        emoji: "👑",
        impactoValor: liderPerc,
        mensagem: `Lider do dia: ${lider.NOME_VENDEDOR} com ${formatPercentBR(liderPerc)} da meta.`,
      })
    }

    if (hojeOrdenadoPorPercMeta.length > 1 && lider) {
      const segundo = hojeOrdenadoPorPercMeta[1]
      const segundoPerc = getPercMetaDia(segundo)
      const diffPerc = liderPerc - segundoPerc
      alertasGerente.push({
        tipo: "disputa_topo",
        emoji: "⚔️",
        impactoValor: diffPerc,
        mensagem: `Diferença de ${formatPercentBR(diffPerc)} entre 1º e 2º lugar (% da meta).`,
      })
    }

    if (movimentos.length > 0) {
      const m = movimentos[0]
      if (m.delta > 0) {
        alertasGerente.push({
          tipo: "subiu_posicao",
          emoji: "🚀",
          impactoValor: null,
          mensagem: `${m.nome} subiu ${m.delta} ${formatPosicoes(m.delta)}.`,
        })
      } else {
        alertasGerente.push({
          tipo: "caiu_posicao",
          emoji: "⚠️",
          impactoValor: null,
          mensagem: `${m.nome} caiu ${Math.abs(m.delta)} ${formatPosicoes(Math.abs(m.delta))}.`,
        })
      }
    }

    const alertasVendedor = []
    if (skVendedor) {
      const hojeV = mapHoje.get(Number(skVendedor))
      const ontemV = mapOntem.get(Number(skVendedor))

      if (hojeV) {
        const rankHoje = Number(hojeV.RANKING_DIA)
        const idxHojePorPerc = hojeOrdenadoPorPercMeta.findIndex(
          (x) => Number(x.SK_VENDEDOR) === Number(skVendedor)
        )

        if (ontemV) {
          const rankOntem = Number(ontemV.RANKING_DIA)
          const delta = rankOntem - rankHoje

          if (delta > 0) {
            alertasVendedor.push({
              tipo: "subiu_posicao",
              emoji: "🔥",
              impactoValor: null,
              mensagem: `Voce subiu ${delta} ${formatPosicoes(delta)}.`,
            })
          } else if (delta < 0) {
            alertasVendedor.push({
              tipo: "perdeu_posicao",
              emoji: "⚠️",
              impactoValor: null,
              mensagem: `Voce caiu ${Math.abs(delta)} ${formatPosicoes(Math.abs(delta))}.`,
            })
          }
        }

        const acima =
          idxHojePorPerc > 0 ? hojeOrdenadoPorPercMeta[idxHojePorPerc - 1] : null

        if (acima) {
          const diffPerc = getPercMetaDia(acima) - getPercMetaDia(hojeV)
          alertasVendedor.push({
            tipo: "distancia_proximo",
            emoji: "🎯",
            impactoValor: diffPerc,
            mensagem: `Faltam ${formatPercentBR(diffPerc)} para ultrapassar ${acima.NOME_VENDEDOR} (% da meta).`,
          })
        }

        alertasVendedor.push({
          tipo: "tempo_real",
          emoji: "⚡",
          impactoValor: Number(hojeV.RECEITA_DIA),
          mensagem: `Hoje voce ja fez ${formatMoneyBR(hojeV.RECEITA_DIA)}.`,
        })
      }
    }

    return res.json({
      referencia: {
        hoje: formatDateISO(dataHoje),
        ontem: formatDateISO(dataOntem),
      },
      alertasGerente,
      alertasVendedor,
    })
  } catch (err) {
    console.error("Erro alertas-ranking:", err)
    return res.status(500).json({ error: "Erro ao gerar alertas de ranking" })
  }
})

export default router

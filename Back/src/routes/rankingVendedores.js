import express from "express"
import { query } from "../db/oracle.js"
import { queryOracleByEmpresaId } from "../db/oracle-tenants.js"
import {
  getRankingVendorsDayViewName,
  getRankingVendorsViewName,
} from "../db/oracleObjectNames.js"
import { requireAuth } from "../middleware/auth.js"
import { canUseGlobalEmpresaScope, getScopedEmpresaId } from "../services/requestScope.js"

const router = express.Router()

function normalizeRow(row) {
  const lower = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.toLowerCase(), value])
  )

  return {
    ...row,
    ...lower,
    nome: lower.nome_vendedor ?? null,
    receita: lower.receita_mes ?? lower.receita_dia ?? 0,
    meta: lower.meta_mes ?? lower.meta_diaria_necessaria ?? 0,
    percentual: lower.perc_atingimento ?? lower.perc_performance_dia ?? 0,
    posicao: lower.ranking_atingimento ?? lower.ranking_dia ?? null
  }
}

async function getQueryContext(empresaId) {
  if (empresaId) {
    return {
      query: (sql, binds = {}, options = {}) => queryOracleByEmpresaId(empresaId, sql, binds, options),
      rankingView: "VW_RANKING_VENDEDORES",
      rankingDayView: "VW_RANKING_VENDEDORES_DIA",
    }
  }

  const [rankingView, rankingDayView] = await Promise.all([
    getRankingVendorsViewName(),
    getRankingVendorsDayViewName(),
  ])

  return {
    query,
    rankingView,
    rankingDayView,
  }
}

router.get("/ranking-vendedores", requireAuth, async (req, res) => {
  try {
    const modo = req.query.modo || "mensal"
    const empresaId = getScopedEmpresaId(req)
    if (!empresaId && !canUseGlobalEmpresaScope(req)) {
      return res.status(403).json({ error: "Empresa do usuario nao encontrada." })
    }

    const context = await getQueryContext(empresaId)

    let sql = ""

    if (modo === "diario") {
      sql = `
        SELECT *
        FROM ${context.rankingDayView}
        ORDER BY ranking_dia
      `
    } else {
      sql = `
        SELECT *
        FROM ${context.rankingView}
        ORDER BY ranking_atingimento
      `
    }

    const rows = await context.query(sql)

    res.json(rows.map(normalizeRow))

  } catch (err) {
    console.error("Erro ranking vendedores:", err)
    res.status(500).json({ error: "Erro ao buscar ranking" })
  }
})

export default router

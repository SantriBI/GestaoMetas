import express from "express"
import { queryOracleByEmpresaId } from "../db/oracle-tenants.js"
import { requireAuth } from "../middleware/auth.js"
import { getScopedEmpresaId, getScopedLojaScope } from "../services/requestScope.js"
import {
  buildSellerInCondition,
  getAllowedSellerCodesByEmpresaId,
} from "../services/tenantSellerScope.js"
import { buildLojaInCondition, resolveLojaColumnName } from "../services/lojaScopeService.js"

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
  return {
    query: (sql, binds = {}, options = {}) => queryOracleByEmpresaId(empresaId, sql, binds, options),
    rankingView: "VW_RANKING_VENDEDORES",
    rankingDayView: "VW_RANKING_VENDEDORES_DIA",
  }
}

router.get("/ranking-vendedores", requireAuth, async (req, res) => {
  try {
    const modo = req.query.modo || "mensal"
    const empresaId = getScopedEmpresaId(req)
    if (!empresaId) {
      return res.status(400).json({ error: "empresa_id e obrigatorio para buscar ranking." })
    }

    const context = await getQueryContext(empresaId)
    const allowedSellerCodes = await getAllowedSellerCodesByEmpresaId(empresaId)
    const sellerScope = buildSellerInCondition("sk_vendedor", allowedSellerCodes)

    const lojaScope = await getScopedLojaScope(req)
    if (lojaScope.error) {
      return res.status(lojaScope.error.status).json({ error: lojaScope.error.message })
    }

    let sql = ""
    let binds = sellerScope.binds

    if (modo === "diario") {
      const lojaColumn = await resolveLojaColumnName(empresaId, context.rankingDayView)
      const lojaCondition = buildLojaInCondition(lojaColumn, lojaScope, "loja_scope_dia")
      binds = { ...binds, ...lojaCondition.binds }
      sql = `
        SELECT *
        FROM ${context.rankingDayView}
        WHERE ${sellerScope.clause}
          AND ${lojaCondition.clause}
        ORDER BY ranking_dia
      `
    } else {
      const lojaColumn = await resolveLojaColumnName(empresaId, context.rankingView)
      const lojaCondition = buildLojaInCondition(lojaColumn, lojaScope, "loja_scope_mensal")
      binds = { ...binds, ...lojaCondition.binds }
      sql = `
        SELECT *
        FROM ${context.rankingView}
        WHERE ${sellerScope.clause}
          AND ${lojaCondition.clause}
        ORDER BY ranking_atingimento
      `
    }

    const rows = await context.query(sql, binds)

    res.json(rows.map(normalizeRow))

  } catch (err) {
    console.error("Erro ranking vendedores:", err)
    res.status(500).json({ error: "Erro ao buscar ranking" })
  }
})

export default router

import express from "express"
import { query } from "../db/oracle.js"

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

router.get("/ranking-vendedores", async (req, res) => {
  try {
    const modo = req.query.modo || "mensal"

    let sql = ""

    if (modo === "diario") {
      sql = `
        SELECT *
        FROM DM_VENDAS.VW_RANKING_VENDEDORES_DIA
        ORDER BY ranking_dia
      `
    } else {
      sql = `
        SELECT *
        FROM DM_VENDAS.VW_RANKING_VENDEDORES
        ORDER BY ranking_atingimento
      `
    }

    const rows = await query(sql)

    res.json(rows.map(normalizeRow))

  } catch (err) {
    console.error("Erro ranking vendedores:", err)
    res.status(500).json({ error: "Erro ao buscar ranking" })
  }
})

export default router

import express from "express"
import { queryOracleByEmpresaId } from "../db/oracle-tenants.js"
import { requireAuth } from "../middleware/auth.js"
import { getScopedEmpresaId } from "../services/requestScope.js"

const router = express.Router()

function normalizeRow(row) {
  if (!row) return null
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.toLowerCase(), value])
  )
}

// Vendas (FATO_COCKPIT) chegam ao longo do dia (recarga intraday, a cada ~30min).
// Margem/comissao (FATO_VENDAS_LUCRATIVIDADE) depende do fechamento do ERP e so
// fica disponivel no dia seguinte (D-1). Este endpoint expoe as duas datas de
// referencia separadamente para nao dar a falsa impressao de que tudo esta "atualizado hoje".
router.get("/atualizacao-base", requireAuth, async (req, res) => {
  try {
    const empresaId = getScopedEmpresaId(req)
    if (!empresaId) {
      return res.status(400).json({ error: "empresa_id e obrigatorio." })
    }

    const [vendasRows, margemRows] = await Promise.all([
      queryOracleByEmpresaId(
        empresaId,
        `
        SELECT
          TO_CHAR(TO_DATE(sk_data, 'YYYYMMDD'), 'DD/MM/YYYY') AS data_ultimo_pedido,
          data_hora_recebimento AS hora_ultimo_pedido
        FROM DM_VENDAS.FATO_COCKPIT
        ORDER BY sk_data DESC, data_hora_recebimento DESC
        FETCH FIRST 1 ROWS ONLY
        `
      ),
      queryOracleByEmpresaId(
        empresaId,
        `
        SELECT
          TO_CHAR(TO_DATE(MAX(sk_dt_recebimento), 'YYYYMMDD'), 'DD/MM/YYYY') AS data_margem_atualizada
        FROM DM_VENDAS.FATO_VENDAS_LUCRATIVIDADE
        `
      ),
    ])

    const vendas = normalizeRow(vendasRows?.[0])
    const margem = normalizeRow(margemRows?.[0])

    res.json({
      vendas: vendas
        ? { data: vendas.data_ultimo_pedido ?? null, hora: vendas.hora_ultimo_pedido ?? null }
        : null,
      margem: margem ? { data: margem.data_margem_atualizada ?? null } : null,
    })
  } catch (err) {
    console.error("Erro ao buscar atualizacao da base:", err)
    res.status(500).json({ error: "Erro ao buscar atualizacao da base" })
  }
})

export default router

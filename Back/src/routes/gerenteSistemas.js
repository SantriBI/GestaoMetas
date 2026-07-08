import express from "express"
import { requireAuth, requireRole } from "../middleware/auth.js"
import {
  assertSystemManagerOrganizationAccess,
  listSystemManagerOrganizations,
  listSystemManagerSellers,
} from "../services/gerenteSistemasService.js"
import { auditAction } from "../audit.js"

const router = express.Router()

router.use("/gerente-sistemas", requireAuth, requireRole("GERENTE_SISTEMAS"))

router.get("/gerente-sistemas/organizacoes", async (req, res) => {
  try {
    const organizacoes = await listSystemManagerOrganizations(req.auth.id_usuario)
    return res.json({ data: organizacoes })
  } catch (error) {
    console.error("Erro ao listar organizacoes do gerente de sistemas:", error)
    return res.status(500).json({ error: "Erro ao listar organizacoes liberadas." })
  }
})

router.get("/gerente-sistemas/organizacoes/:empresaId/vendedores", async (req, res) => {
  try {
    const vendedores = await listSystemManagerSellers({
      idUsuario: req.auth.id_usuario,
      empresaId: req.params.empresaId,
    })

    return res.json({ data: vendedores })
  } catch (error) {
    const status = Number(error?.status ?? 500)
    if (status >= 500) {
      console.error("Erro ao listar vendedores para gerente de sistemas:", error)
    }
    return res.status(status).json({ error: error?.message ?? "Erro ao listar vendedores." })
  }
})

router.post("/gerente-sistemas/entrar", async (req, res) => {
  const empresaId = req.body?.empresa_id ?? req.body?.empresaId ?? null
  const view = String(req.body?.view ?? "").toUpperCase()
  const skVendedor = req.body?.sk_vendedor ?? req.body?.skVendedor ?? null

  if (!["GERENTE", "VENDEDOR"].includes(view)) {
    return res.status(400).json({ error: "view deve ser GERENTE ou VENDEDOR." })
  }

  try {
    await assertSystemManagerOrganizationAccess(req.auth.id_usuario, empresaId)

    auditAction(req, "GERENTE_SISTEMAS_ENTRAR", `empresa:${empresaId}`, {
      view,
      sk_vendedor: skVendedor,
    })

    return res.json({ ok: true })
  } catch (error) {
    const status = Number(error?.status ?? 500)
    if (status >= 500) {
      console.error("Erro ao registrar entrada do gerente de sistemas:", error)
    }
    return res.status(status).json({ error: error?.message ?? "Erro ao validar acesso." })
  }
})

export default router

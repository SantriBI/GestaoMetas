import express from "express"
import {
  deleteOrganizacaoHandler,
  getOrganizacao,
  getOrganizacoes,
  postOrganizacao,
  postTestarConexao,
  putOrganizacao,
} from "../controllers/organizacoesController.js"

const router = express.Router()

function requireAdmin(req, res, next) {
  const role = String(req.headers["x-user-role"] ?? "").trim().toUpperCase()
  if (role !== "ADMIN") {
    return res.status(403).json({ error: "Acesso restrito a administradores." })
  }
  next()
}

router.use("/organizacoes", requireAdmin)

router.get("/organizacoes", getOrganizacoes)
router.post("/organizacoes/testar-conexao", postTestarConexao)
router.get("/organizacoes/:id", getOrganizacao)
router.post("/organizacoes", postOrganizacao)
router.put("/organizacoes/:id", putOrganizacao)
router.delete("/organizacoes/:id", deleteOrganizacaoHandler)

export default router

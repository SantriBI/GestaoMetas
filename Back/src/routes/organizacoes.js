import express from "express"
import { requireAuth, requireRole } from "../middleware/auth.js"
import {
  deleteOrganizacaoHandler,
  getOrganizacao,
  getOrganizacoes,
  postOrganizacao,
  postTestarConexao,
  putOrganizacao,
} from "../controllers/organizacoesController.js"

const router = express.Router()

router.use("/organizacoes", requireAuth, requireRole("ADMIN", "SUPERADMIN"))

router.get("/organizacoes", getOrganizacoes)
router.post("/organizacoes/testar-conexao", postTestarConexao)
router.get("/organizacoes/:id", getOrganizacao)
router.post("/organizacoes", postOrganizacao)
router.put("/organizacoes/:id", putOrganizacao)
router.delete("/organizacoes/:id", deleteOrganizacaoHandler)

export default router

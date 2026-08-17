import express from "express"
import { getGrupos, getGruposSemPercentual, postPercentualGrupo } from "../controllers/parametrosPremiacaoController.js"
import { requireAuth } from "../middleware/auth.js"
import { requireFeature } from "../middleware/requireFeature.js"

const router = express.Router()

router.get("/parametros-premiacao/grupos", requireAuth, requireFeature("COMISSOES"), getGrupos)
router.get("/parametros-premiacao/grupos-sem-percentual", requireAuth, requireFeature("COMISSOES"), getGruposSemPercentual)
router.post("/parametros-premiacao/grupos/:nivel/:nomeGrupo", requireAuth, requireFeature("COMISSOES"), postPercentualGrupo)

export default router

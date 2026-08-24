import express from "express"
import { getMinhaPremiacao, getPremiacaoEquipe } from "../controllers/premiacaoVendedorController.js"
import { requireAuth } from "../middleware/auth.js"
import { requireFeature } from "../middleware/requireFeature.js"

const router = express.Router()

router.get("/premiacao/minha-premiacao", requireAuth, requireFeature("PREMIACAO"), getMinhaPremiacao)
router.get("/premiacao/equipe", requireAuth, requireFeature("PREMIACAO"), getPremiacaoEquipe)

export default router

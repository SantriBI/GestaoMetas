import express from "express"
import { getMinhaPremiacao, getPremiacaoEquipe } from "../controllers/premiacaoVendedorController.js"
import { requireAuth } from "../middleware/auth.js"

const router = express.Router()

router.get("/premiacao/minha-premiacao", requireAuth, getMinhaPremiacao)
router.get("/premiacao/equipe", requireAuth, getPremiacaoEquipe)

export default router

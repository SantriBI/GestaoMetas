import express from "express"
import { requireAuth } from "../middleware/auth.js"
import { getMinhasLojas } from "../controllers/lojaAcessoController.js"

const router = express.Router()

router.use(requireAuth)
router.get("/minhas-lojas", getMinhasLojas)

export default router

import express from "express"
import {
  getPerfilVendedor,
  postPerfilVendedor,
  putPerfilVendedor,
} from "../controllers/perfilVendedorController.js"
import { requireAuth } from "../middleware/auth.js"

const router = express.Router()

router.use(requireAuth)

router.get("/perfil-vendedor/:vendedor_id", getPerfilVendedor)
router.post("/perfil-vendedor", postPerfilVendedor)
router.put("/perfil-vendedor/:id", putPerfilVendedor)

export default router

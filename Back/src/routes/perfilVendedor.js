import express from "express"
import {
  getPerfilVendedor,
  postPerfilVendedor,
  putPerfilVendedor,
} from "../controllers/perfilVendedorController.js"

const router = express.Router()

router.get("/perfil-vendedor/:vendedor_id", getPerfilVendedor)
router.post("/perfil-vendedor", postPerfilVendedor)
router.put("/perfil-vendedor/:id", putPerfilVendedor)

export default router

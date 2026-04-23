import express from "express"
import {
  getObjetivoVendedor,
  getObjetivosVendedor,
  postObjetivoVendedor,
  putObjetivoVendedor,
} from "../controllers/objetivoVendedorController.js"

const router = express.Router()

router.get("/objetivo-vendedor/:vendedor_id", getObjetivoVendedor)
router.get("/objetivos-vendedor/:vendedor_id", getObjetivosVendedor)
router.post("/objetivo-vendedor", postObjetivoVendedor)
router.put("/objetivo-vendedor/:id", putObjetivoVendedor)

export default router

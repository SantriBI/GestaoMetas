import express from "express"
import {
  getPreview,
  getResumo,
  getSegmentos,
  getTemplates,
  postCampanha,
  postEnviarCampanha,
  postTemplate,
  putTemplate,
} from "../controllers/ativacaoClientesController.js"

const router = express.Router()

router.get("/ativacao-clientes/segmentos", getSegmentos)
router.get("/ativacao-clientes/resumo", getResumo)
router.get("/ativacao-clientes/preview", getPreview)
router.post("/ativacao-clientes/campanhas", postCampanha)
router.post("/ativacao-clientes/campanhas/:id/enviar", postEnviarCampanha)

router.get("/templates-mensagens", getTemplates)
router.post("/templates-mensagens", postTemplate)
router.put("/templates-mensagens/:id", putTemplate)

export default router

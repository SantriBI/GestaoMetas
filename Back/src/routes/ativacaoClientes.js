import express from "express"
import {
  getCampanhaDashboard,
  getCentralNegociacao,
  getPreview,
  getResumo,
  getSegmentos,
  getTemplates,
  postCampanha,
  postCentralNegociacaoEvento,
  postEnviarCampanha,
  postTemplate,
  postZapiWebhook,
  putTemplate,
} from "../controllers/ativacaoClientesController.js"

const router = express.Router()

router.get("/ativacao-clientes/segmentos", getSegmentos)
router.get("/ativacao-clientes/resumo", getResumo)
router.get("/ativacao-clientes/preview", getPreview)
router.post("/ativacao-clientes/campanhas", postCampanha)
router.post("/ativacao-clientes/campanhas/:id/enviar", postEnviarCampanha)
router.get("/ativacao-clientes/campanhas/:id/dashboard", getCampanhaDashboard)
router.get("/ativacao-clientes/negociacao/:token", getCentralNegociacao)
router.post("/ativacao-clientes/negociacao/:token/eventos", postCentralNegociacaoEvento)
router.post("/webhooks/zapi", postZapiWebhook)

router.get("/templates-mensagens", getTemplates)
router.post("/templates-mensagens", postTemplate)
router.put("/templates-mensagens/:id", putTemplate)

export default router

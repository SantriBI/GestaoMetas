import express from "express"
import {
  deleteDesafio,
  getDesafioById,
  getDesafioMarcasCatalogo,
  getDesafioMetadata,
  getDesafioParticipantes,
  getDesafioProdutosCatalogo,
  getDesafioProgresso,
  getDesafioSetup,
  getDesafios,
  getVendedorDesafioDetalhe,
  getVendedorDesafios,
  getVendedorDesafiosDisponiveis,
  getVendedorDesafiosAtivos,
  getVendedorDesafiosNovos,
  postDesafioImpactPreview,
  postAceitarDesafio,
  postRecusarDesafio,
  postDesafio,
  postVisualizarDesafio,
  putDesafio,
} from "../controllers/desafiosController.js"

const router = express.Router()

router.get("/desafios/metadata", getDesafioMetadata)
router.get("/desafios/catalogo/produtos", getDesafioProdutosCatalogo)
router.get("/desafios/catalogo/marcas", getDesafioMarcasCatalogo)
router.get("/desafios/setup", getDesafioSetup)
router.post("/desafios/impact-preview", postDesafioImpactPreview)
router.get("/desafios", getDesafios)
router.post("/desafios", postDesafio)
router.get("/desafios/:id", getDesafioById)
router.put("/desafios/:id", putDesafio)
router.delete("/desafios/:id", deleteDesafio)
router.get("/desafios/:id/participantes", getDesafioParticipantes)
router.post("/desafios/:id/aceitar", postAceitarDesafio)
router.post("/desafios/:id/recusar", postRecusarDesafio)
router.post("/desafios/:id/visualizar", postVisualizarDesafio)
router.get("/desafios/:id/progresso", getDesafioProgresso)

router.get("/vendedor/:sk_vendedor/desafios", getVendedorDesafios)
router.get("/vendedor/:sk_vendedor/desafios/novos", getVendedorDesafiosNovos)
router.get("/vendedor/:sk_vendedor/desafios/disponiveis", getVendedorDesafiosDisponiveis)
router.get("/vendedor/:sk_vendedor/desafios/ativos", getVendedorDesafiosAtivos)
router.get("/vendedor/:sk_vendedor/desafios/:id", getVendedorDesafioDetalhe)

export default router

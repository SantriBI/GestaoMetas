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
import { requireAuth, requireRole } from "../middleware/auth.js"

const router = express.Router()

router.use(requireAuth)

const requireChallengeManager = requireRole("GERENTE", "ADMIN", "SUPERADMIN")

router.get("/desafios/metadata", requireChallengeManager, getDesafioMetadata)
router.get("/desafios/catalogo/produtos", requireChallengeManager, getDesafioProdutosCatalogo)
router.get("/desafios/catalogo/marcas", requireChallengeManager, getDesafioMarcasCatalogo)
router.get("/desafios/setup", requireChallengeManager, getDesafioSetup)
router.post("/desafios/impact-preview", requireChallengeManager, postDesafioImpactPreview)
router.get("/desafios", requireChallengeManager, getDesafios)
router.post("/desafios", requireChallengeManager, postDesafio)
router.get("/desafios/:id", requireChallengeManager, getDesafioById)
router.put("/desafios/:id", requireChallengeManager, putDesafio)
router.delete("/desafios/:id", requireChallengeManager, deleteDesafio)
router.get("/desafios/:id/participantes", requireChallengeManager, getDesafioParticipantes)
router.post("/desafios/:id/aceitar", requireRole("VENDEDOR"), postAceitarDesafio)
router.post("/desafios/:id/recusar", requireRole("VENDEDOR"), postRecusarDesafio)
router.post("/desafios/:id/visualizar", requireRole("VENDEDOR"), postVisualizarDesafio)
router.get("/desafios/:id/progresso", requireChallengeManager, getDesafioProgresso)

router.get("/vendedor/:sk_vendedor/desafios", getVendedorDesafios)
router.get("/vendedor/:sk_vendedor/desafios/novos", getVendedorDesafiosNovos)
router.get("/vendedor/:sk_vendedor/desafios/disponiveis", getVendedorDesafiosDisponiveis)
router.get("/vendedor/:sk_vendedor/desafios/ativos", getVendedorDesafiosAtivos)
router.get("/vendedor/:sk_vendedor/desafios/:id", getVendedorDesafioDetalhe)

export default router

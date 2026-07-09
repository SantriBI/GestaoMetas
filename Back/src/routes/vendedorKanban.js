import express from "express"
import { requireAuth } from "../middleware/auth.js"
import {
  getBoard,
  getArquivados,
  getColunaPagina,
  getClientesBusca,
  postCard,
  getCardDetalhe,
  patchCard,
  postInteracao,
  patchArquivar,
} from "../controllers/vendedorKanbanController.js"

const router = express.Router()

router.use(requireAuth)

router.get("/vendedor/:sk_vendedor/kanban", getBoard)
router.get("/vendedor/:sk_vendedor/kanban/arquivados", getArquivados)
router.get("/vendedor/:sk_vendedor/kanban/coluna/:coluna", getColunaPagina)
router.get("/vendedor/:sk_vendedor/clientes/busca", getClientesBusca)
router.post("/vendedor/:sk_vendedor/kanban/cards", postCard)
router.get("/vendedor/:sk_vendedor/kanban/cards/:cardId", getCardDetalhe)
router.patch("/vendedor/:sk_vendedor/kanban/cards/:cardId", patchCard)
router.post("/vendedor/:sk_vendedor/kanban/cards/:cardId/interacoes", postInteracao)
router.patch("/vendedor/:sk_vendedor/kanban/cards/:cardId/arquivar", patchArquivar)

export default router

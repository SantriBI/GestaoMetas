import express from "express"
import { getMinhaPremiacao, getPremiacaoEquipe, getMesesDisponiveisPremiacao } from "../controllers/premiacaoVendedorController.js"
import {
  getSimulador,
  getContadores,
  getFaixasAcelerador,
  postFaixasAcelerador,
  getGruposSimulador,
} from "../controllers/premiacaoSimuladorController.js"
import { requireAuth } from "../middleware/auth.js"
import { requireFeature } from "../middleware/requireFeature.js"
import { requireSimuladorPremiacao } from "../middleware/requireSimuladorPremiacao.js"

const router = express.Router()

router.get("/premiacao/minha-premiacao", requireAuth, requireFeature("PREMIACAO"), getMinhaPremiacao)
router.get("/premiacao/equipe", requireAuth, requireFeature("PREMIACAO"), getPremiacaoEquipe)
router.get("/premiacao/meses-disponiveis", requireAuth, requireFeature("PREMIACAO"), getMesesDisponiveisPremiacao)

// Simulador de margem/premiacao (Fase 1 do Plano Tecnico de Melhorias para Vendedores).
// requireSimuladorPremiacao vem primeiro: desligado (padrao), responde 404 sem consultar banco.
router.get("/premiacao/minha-premiacao/simulador", requireSimuladorPremiacao, requireAuth, requireFeature("PREMIACAO"), getSimulador)
router.get("/premiacao/minha-premiacao/simulador/grupos", requireSimuladorPremiacao, requireAuth, requireFeature("PREMIACAO"), getGruposSimulador)
router.get("/premiacao/minha-premiacao/contadores", requireSimuladorPremiacao, requireAuth, requireFeature("PREMIACAO"), getContadores)

// Escada de faixas do acelerador (cadastro do gerente, tela Comissoes).
router.get("/premiacao/faixas-acelerador", requireAuth, requireFeature("COMISSOES"), getFaixasAcelerador)
router.post("/premiacao/faixas-acelerador", requireAuth, requireFeature("COMISSOES"), postFaixasAcelerador)

export default router

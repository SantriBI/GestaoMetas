import {
  buscarMinhaPremiacao,
  listarPremiacaoEquipe,
  listarMesesDisponiveis,
  PremiacaoVendedorError,
} from "../services/premiacaoVendedorService.js"
import { verificarSeUsuarioEhGerente } from "../services/parametrosPremiacaoService.js"
import { getScopedLojaScope } from "../services/requestScope.js"

function handleError(res, error, fallbackMessage) {
  if (error instanceof PremiacaoVendedorError) {
    return res.status(error.statusCode).json({ error: error.message })
  }
  console.error(fallbackMessage, error)
  return res.status(500).json({ error: fallbackMessage })
}

export function createPremiacaoVendedorController(deps = {}) {
  const {
    buscarPremiacao = buscarMinhaPremiacao,
    listarEquipe = listarPremiacaoEquipe,
    listarMeses = listarMesesDisponiveis,
    verificarGerente = verificarSeUsuarioEhGerente,
    resolverLojaScope = getScopedLojaScope,
  } = deps

  async function getMinhaPremiacao(req, res) {
    try {
      const empresaId = req.auth?.empresa_id ?? null
      const skVendedor = req.auth?.sk_vendedor ?? null

      const premiacao = await buscarPremiacao(empresaId, skVendedor)
      if (!premiacao) {
        return res.status(404).json({ error: "Nenhuma comissao do ERP encontrada para o mes corrente." })
      }

      return res.json({ data: premiacao })
    } catch (error) {
      return handleError(res, error, "Erro ao buscar premiacao do vendedor.")
    }
  }

  /**
   * Visao do gerente: premiacao do mes corrente de todos os vendedores das lojas dele.
   * Revalida o papel de gerente (verificarSeUsuarioEhGerente, contra FATO_FUNCIONARIOS_ACESSOS)
   * e o escopo de loja (getScopedLojaScope, mesmo padrao da rota de ranking) antes de consultar -
   * nunca aceita SK_EMPRESAS/empresa_acesso direto do frontend sem revalidar no servidor.
   */
  async function getPremiacaoEquipe(req, res) {
    try {
      const empresaId = req.auth?.empresa_id ?? null
      const usuarioId = req.auth?.id_usuario ?? null
      const cpf = req.auth?.cpf ?? null
      const role = req.auth?.role ?? null

      const ehGerente = await verificarGerente(empresaId, usuarioId, { cpf, role })
      if (!ehGerente) {
        return res.status(403).json({ error: "Apenas gerentes podem visualizar a premiacao da equipe." })
      }

      const lojaScope = await resolverLojaScope(req)
      if (lojaScope.error) {
        return res.status(lojaScope.error.status).json({ error: lojaScope.error.message })
      }

      const mes = req.query?.mes ?? null
      const resultado = await listarEquipe(empresaId, lojaScope, { mes })
      return res.json({ data: resultado })
    } catch (error) {
      return handleError(res, error, "Erro ao buscar premiacao da equipe.")
    }
  }

  /**
   * Meses disponiveis em FT_COMISSAO_HISTORICO para o gerente logado (popula o seletor de mes
   * da tela de equipe). Mesma revalidacao de papel/escopo de loja que getPremiacaoEquipe.
   */
  async function getMesesDisponiveisPremiacao(req, res) {
    try {
      const empresaId = req.auth?.empresa_id ?? null
      const usuarioId = req.auth?.id_usuario ?? null
      const cpf = req.auth?.cpf ?? null
      const role = req.auth?.role ?? null

      const ehGerente = await verificarGerente(empresaId, usuarioId, { cpf, role })
      if (!ehGerente) {
        return res.status(403).json({ error: "Apenas gerentes podem visualizar a premiacao da equipe." })
      }

      const lojaScope = await resolverLojaScope(req)
      if (lojaScope.error) {
        return res.status(lojaScope.error.status).json({ error: lojaScope.error.message })
      }

      const resultado = await listarMeses(empresaId, lojaScope)
      return res.json({ data: resultado })
    } catch (error) {
      return handleError(res, error, "Erro ao buscar meses disponiveis da premiacao.")
    }
  }

  return { getMinhaPremiacao, getPremiacaoEquipe, getMesesDisponiveisPremiacao }
}

export const { getMinhaPremiacao, getPremiacaoEquipe, getMesesDisponiveisPremiacao } = createPremiacaoVendedorController()

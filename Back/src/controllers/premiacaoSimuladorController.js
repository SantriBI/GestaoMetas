import {
  simularCenario,
  calcularContadoresVenda,
  listarFaixasAcelerador,
  salvarFaixasAcelerador,
  listarGruposHistoricosVendedor,
  PremiacaoSimuladorError,
} from "../services/premiacaoSimuladorService.js"
import { verificarSeUsuarioEhGerente } from "../services/parametrosPremiacaoService.js"

function handleError(res, error, fallbackMessage) {
  if (error instanceof PremiacaoSimuladorError) {
    return res.status(error.statusCode).json({ error: error.message })
  }
  console.error(fallbackMessage, error)
  return res.status(500).json({ error: fallbackMessage })
}

/**
 * Fabrica dos handlers, com as dependencias de servico injetaveis para teste (mesmo padrao de
 * createPremiacaoVendedorController/createParametrosPremiacaoController).
 */
export function createPremiacaoSimuladorController(deps = {}) {
  const {
    simular = simularCenario,
    calcularContadores = calcularContadoresVenda,
    listarFaixas = listarFaixasAcelerador,
    salvarFaixas = salvarFaixasAcelerador,
    listarGruposHistoricos = listarGruposHistoricosVendedor,
    verificarGerente = verificarSeUsuarioEhGerente,
  } = deps

  /**
   * Simula o cenario "se eu vender mais R$X do grupo Y" - sk_vendedor SEMPRE vem do vendedor
   * autenticado (req.auth.sk_vendedor), nunca aceito do query string, mesmo padrao de
   * getMinhaPremiacao.
   */
  async function getSimulador(req, res) {
    try {
      const empresaId = req.auth?.empresa_id ?? null
      const skVendedor = req.auth?.sk_vendedor ?? null

      const { nivel, grupo, valor } = req.query ?? {}
      const resultado = await simular(empresaId, skVendedor, {
        nivel,
        grupoNome: grupo,
        valorVendaAdicional: valor,
      })
      return res.json({ data: resultado })
    } catch (error) {
      return handleError(res, error, "Erro ao simular cenario de premiacao.")
    }
  }

  /**
   * Contadores prontos (sem parametros do front): falta ate o gatilho e ate a proxima faixa,
   * em R$ de venda, no grupo de maior receita historica do vendedor.
   */
  async function getContadores(req, res) {
    try {
      const empresaId = req.auth?.empresa_id ?? null
      const skVendedor = req.auth?.sk_vendedor ?? null
      const nivel = req.query?.nivel ?? 3

      const resultado = await calcularContadores(empresaId, skVendedor, { nivel })
      return res.json({ data: resultado })
    } catch (error) {
      return handleError(res, error, "Erro ao calcular contadores de venda.")
    }
  }

  async function getFaixasAcelerador(req, res) {
    try {
      const empresaId = req.auth?.empresa_id ?? null
      const faixas = await listarFaixas(empresaId)
      return res.json({ data: faixas })
    } catch (error) {
      return handleError(res, error, "Erro ao listar faixas do acelerador.")
    }
  }

  /**
   * Cadastro da escada de faixas (visao do gerente) - revalida o papel de gerente contra
   * FATO_FUNCIONARIOS_ACESSOS, mesmo padrao de postPercentualGrupo.
   */
  async function postFaixasAcelerador(req, res) {
    try {
      const empresaId = req.auth?.empresa_id ?? null
      const usuarioId = req.auth?.id_usuario ?? null
      const cpf = req.auth?.cpf ?? null
      const role = req.auth?.role ?? null

      const ehGerente = await verificarGerente(empresaId, usuarioId, { cpf, role })
      if (!ehGerente) {
        return res.status(403).json({ error: "Apenas gerentes podem cadastrar a escada de faixas do acelerador." })
      }

      const { faixas } = req.body ?? {}
      const resultado = await salvarFaixas(empresaId, faixas, usuarioId)
      return res.json({ data: resultado })
    } catch (error) {
      return handleError(res, error, "Erro ao salvar faixas do acelerador.")
    }
  }

  /**
   * Grupos de produto que o vendedor autenticado efetivamente vendeu na janela historica
   * padrao (independente da flag COMISSOES) - alimenta o seletor de grupo do simulador.
   */
  async function getGruposSimulador(req, res) {
    try {
      const empresaId = req.auth?.empresa_id ?? null
      const skVendedor = req.auth?.sk_vendedor ?? null
      const nivel = req.query?.nivel ?? 3

      const grupos = await listarGruposHistoricos(empresaId, skVendedor, nivel)
      return res.json({ data: grupos })
    } catch (error) {
      return handleError(res, error, "Erro ao listar grupos do simulador.")
    }
  }

  return { getSimulador, getContadores, getFaixasAcelerador, postFaixasAcelerador, getGruposSimulador }
}

export const { getSimulador, getContadores, getFaixasAcelerador, postFaixasAcelerador, getGruposSimulador } =
  createPremiacaoSimuladorController()

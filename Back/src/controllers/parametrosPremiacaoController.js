import {
  listarGruposComPercentualVigente,
  listarGruposSemPercentual,
  salvarPercentualGrupo,
  verificarSeUsuarioEhGerente,
  ParametrosPremiacaoError,
} from "../services/parametrosPremiacaoService.js"

function handleError(res, error, fallbackMessage) {
  if (error instanceof ParametrosPremiacaoError) {
    return res.status(error.statusCode).json({ error: error.message })
  }
  console.error(fallbackMessage, error)
  return res.status(500).json({ error: fallbackMessage })
}

/**
 * Fabrica dos handlers, com as dependencias de servico injetaveis para teste (sem isso, testar
 * o guard de 403 exigiria bater no Oracle real via verificarSeUsuarioEhGerente/salvarPercentualGrupo).
 */
export function createParametrosPremiacaoController(deps = {}) {
  const {
    listarGrupos = listarGruposComPercentualVigente,
    listarSemPercentual = listarGruposSemPercentual,
    salvarPercentual = salvarPercentualGrupo,
    verificarGerente = verificarSeUsuarioEhGerente,
  } = deps

  async function getGrupos(req, res) {
    try {
      const empresaId = req.auth?.empresa_id ?? null
      const nivel = req.query?.nivel ?? 3
      const grupos = await listarGrupos(empresaId, nivel)
      return res.json({ data: grupos })
    } catch (error) {
      return handleError(res, error, "Erro ao listar grupos de premiacao.")
    }
  }

  async function getGruposSemPercentual(req, res) {
    try {
      const empresaId = req.auth?.empresa_id ?? null
      const mes = req.query?.mes ?? null
      const grupos = await listarSemPercentual(empresaId, mes)
      return res.json({ data: grupos })
    } catch (error) {
      return handleError(res, error, "Erro ao listar grupos sem percentual cadastrado.")
    }
  }

  async function postPercentualGrupo(req, res) {
    try {
      const empresaId = req.auth?.empresa_id ?? null
      const usuarioId = req.auth?.id_usuario ?? null
      const cpf = req.auth?.cpf ?? null
      const role = req.auth?.role ?? null

      const ehGerente = await verificarGerente(empresaId, usuarioId, { cpf, role })
      if (!ehGerente) {
        return res.status(403).json({ error: "Apenas gerentes podem cadastrar percentuais de premiacao." })
      }

      const { nivel, nomeGrupo } = req.params
      const { percentual } = req.body ?? {}

      const resultado = await salvarPercentual(empresaId, nivel, nomeGrupo, percentual, usuarioId)
      return res.json({ data: resultado })
    } catch (error) {
      return handleError(res, error, "Erro ao salvar percentual de premiacao.")
    }
  }

  return { getGrupos, getGruposSemPercentual, postPercentualGrupo }
}

export const { getGrupos, getGruposSemPercentual, postPercentualGrupo } = createParametrosPremiacaoController()

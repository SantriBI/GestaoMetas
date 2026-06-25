import {
  createOrganizacao,
  deleteOrganizacao,
  getOrganizacaoById,
  listOrganizacoes,
  testarConexaoOracle,
  testarConexaoOrganizacaoSalva,
  updateOrganizacao,
} from "../services/organizacoesService.js"

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error)
  const message = error instanceof Error ? error.message : fallbackMessage
  const status = Number(error?.status) || 500
  return res.status(status).json({ error: message })
}

export async function getOrganizacoes(req, res) {
  try {
    const data = await listOrganizacoes()
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao listar organizacoes.")
  }
}

export async function getOrganizacao(req, res) {
  try {
    const data = await getOrganizacaoById(req.params.id)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao buscar organizacao.")
  }
}

export async function postOrganizacao(req, res) {
  try {
    const data = await createOrganizacao(req.body)
    return res.status(201).json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao criar organizacao.")
  }
}

export async function putOrganizacao(req, res) {
  try {
    const data = await updateOrganizacao(req.params.id, req.body)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao atualizar organizacao.")
  }
}

export async function deleteOrganizacaoHandler(req, res) {
  try {
    const data = await deleteOrganizacao(req.params.id)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao remover organizacao.")
  }
}

export async function postTestarConexao(req, res) {
  try {
    const { db_user, db_password, db_connect_string, id } = req.body

    let result
    if (id) {
      result = await testarConexaoOrganizacaoSalva(id)
    } else {
      result = await testarConexaoOracle(db_user, db_password, db_connect_string)
    }

    return res.json(result)
  } catch (error) {
    return handleError(res, error, "Erro ao testar conexao Oracle.")
  }
}

import {
  createSellerProfile,
  getSellerProfile,
  updateSellerProfile,
} from "../services/objetivoVendedorService.js"

function getErrorStatus(message) {
  if (message.includes("nao encontrado")) return 404
  if (message.includes("obrigatorio") || message.includes("invalido")) return 400
  if (message.includes("pertence")) return 403
  return 500
}

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error)
  const message = error instanceof Error ? error.message : fallbackMessage
  const status = Number(error?.status) || getErrorStatus(message)
  return res.status(status).json({
    code: error?.code ?? null,
    error: message,
    details: error?.details ?? null,
  })
}

export async function getPerfilVendedor(req, res) {
  try {
    const data = await getSellerProfile(req.params.vendedor_id)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao buscar perfil do vendedor.")
  }
}

export async function postPerfilVendedor(req, res) {
  try {
    const data = await createSellerProfile(req.body)
    return res.status(201).json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao criar perfil do vendedor.")
  }
}

export async function putPerfilVendedor(req, res) {
  try {
    const data = await updateSellerProfile(req.params.id, req.body)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao atualizar perfil do vendedor.")
  }
}

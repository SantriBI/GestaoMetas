import {
  createSellerLifeGoal,
  getSellerLifeGoal,
  getSellerLifeGoals,
  updateSellerLifeGoal,
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

export async function getObjetivoVendedor(req, res) {
  try {
    const data = await getSellerLifeGoal(req.params.vendedor_id)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao buscar objetivo do vendedor.")
  }
}

export async function getObjetivosVendedor(req, res) {
  try {
    const data = await getSellerLifeGoals(req.params.vendedor_id)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao buscar objetivos do vendedor.")
  }
}

export async function postObjetivoVendedor(req, res) {
  try {
    const data = await createSellerLifeGoal(req.body)
    return res.status(201).json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao criar objetivo do vendedor.")
  }
}

export async function putObjetivoVendedor(req, res) {
  try {
    const data = await updateSellerLifeGoal(req.params.id, req.body)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao atualizar objetivo do vendedor.")
  }
}

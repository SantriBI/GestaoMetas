import {
  acceptChallenge,
  closeChallenge,
  createChallenge,
  declineChallenge,
  getChallengeById,
  getSellerChallengeAlert,
  getChallengeModuleSetup,
  getChallengeParticipants,
  getSellerChallengeById,
  listChallengeMetadata,
  listChallenges,
  listSellerChallenges,
  markChallengeSeen,
  previewChallengeImpact,
  refreshChallengeProgress,
  searchChallengeBrands,
  searchChallengeProducts,
  updateChallenge,
} from "../services/desafios/desafiosService.js"

function getErrorStatus(message) {
  if (message.includes("nao encontrado")) return 404
  if (message.includes("obrigatorio") || message.includes("invalido") || message.includes("nao pode")) return 400
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

export async function getDesafios(req, res) {
  try {
    const data = await listChallenges()
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao listar desafios.")
  }
}

export async function getDesafioMetadata(req, res) {
  try {
    const data = await listChallengeMetadata()
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao carregar metadados de desafios.")
  }
}

export async function getDesafioProdutosCatalogo(req, res) {
  try {
    const data = await searchChallengeProducts(req.query.q ?? "")
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao buscar produtos do desafio.")
  }
}

export async function getDesafioMarcasCatalogo(req, res) {
  try {
    const data = await searchChallengeBrands(req.query.q ?? "")
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao buscar marcas do desafio.")
  }
}

export async function getDesafioSetup(req, res) {
  try {
    const data = await getChallengeModuleSetup()
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao verificar inicializacao do modulo de desafios.")
  }
}

export async function postDesafioImpactPreview(req, res) {
  try {
    const data = await previewChallengeImpact(req.body)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao calcular impacto estimado do desafio.")
  }
}

export async function postDesafio(req, res) {
  try {
    const data = await createChallenge(req.body)
    return res.status(201).json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao criar desafio.")
  }
}

export async function getDesafioById(req, res) {
  try {
    const data = await getChallengeById(req.params.id)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao buscar desafio.")
  }
}

export async function putDesafio(req, res) {
  try {
    const data = await updateChallenge(req.params.id, req.body)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao atualizar desafio.")
  }
}

export async function deleteDesafio(req, res) {
  try {
    const data = await closeChallenge(req.params.id, req.query.status ?? "ENCERRADO")
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao encerrar desafio.")
  }
}

export async function getDesafioParticipantes(req, res) {
  try {
    const data = await getChallengeParticipants(req.params.id)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao listar participantes.")
  }
}

export async function postAceitarDesafio(req, res) {
  try {
    const skVendedor = req.body?.sk_vendedor ?? req.body?.skVendedor
    const data = await acceptChallenge(req.params.id, skVendedor)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao aceitar desafio.")
  }
}

export async function postRecusarDesafio(req, res) {
  try {
    const skVendedor = req.body?.sk_vendedor ?? req.body?.skVendedor
    const data = await declineChallenge(req.params.id, skVendedor)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao recusar desafio.")
  }
}

export async function getDesafioProgresso(req, res) {
  try {
    const data = await refreshChallengeProgress(req.params.id, req.query.sk_vendedor ?? null)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao calcular progresso do desafio.")
  }
}

export async function getVendedorDesafios(req, res) {
  try {
    const data = await listSellerChallenges(req.params.sk_vendedor, "all")
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao listar desafios do vendedor.")
  }
}

export async function getVendedorDesafiosAtivos(req, res) {
  try {
    const data = await listSellerChallenges(req.params.sk_vendedor, "ativos")
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao listar desafios ativos.")
  }
}

export async function getVendedorDesafiosDisponiveis(req, res) {
  try {
    const data = await listSellerChallenges(req.params.sk_vendedor, "disponiveis")
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao listar desafios disponiveis.")
  }
}

export async function getVendedorDesafiosNovos(req, res) {
  try {
    const data = await getSellerChallengeAlert(req.params.sk_vendedor)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao listar desafios novos.")
  }
}

export async function getVendedorDesafioDetalhe(req, res) {
  try {
    const data = await getSellerChallengeById(req.params.id, req.params.sk_vendedor)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao buscar detalhe do desafio do vendedor.")
  }
}

export async function postVisualizarDesafio(req, res) {
  try {
    const skVendedor = req.body?.sk_vendedor ?? req.body?.skVendedor
    const data = await markChallengeSeen(req.params.id, skVendedor)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao registrar visualizacao do desafio.")
  }
}

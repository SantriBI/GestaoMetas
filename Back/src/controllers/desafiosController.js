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
import { queryOracleByEmpresaId } from "../db/oracle-tenants.js"
import { getScopedEmpresaId } from "../services/requestScope.js"
import { findAuthUserBySkVendedor } from "../services/authUsersService.js"

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

function getChallengeContext(req, res) {
  const empresaId = getScopedEmpresaId(req)
  if (!empresaId) {
    res.status(403).json({ error: "Empresa do usuario nao encontrada." })
    return null
  }

  return {
    empresaId,
    query: (sql, binds = {}, options = {}) => queryOracleByEmpresaId(empresaId, sql, binds, options),
  }
}

function getAuthRole(req) {
  return String(req.auth?.role ?? "").toUpperCase()
}

async function getSellerFromRequest(req, res, sourceSkVendedor = null, empresaId = null) {
  const role = getAuthRole(req)
  const authSkVendedor = req.auth?.sk_vendedor ?? null
  const requestedSkVendedor = sourceSkVendedor ?? req.body?.sk_vendedor ?? req.body?.skVendedor ?? null

  if (role === "VENDEDOR") {
    if (!authSkVendedor) {
      res.status(403).json({ error: "Vendedor autenticado nao encontrado." })
      return null
    }

    if (requestedSkVendedor && String(requestedSkVendedor) !== String(authSkVendedor)) {
      res.status(403).json({ error: "Acesso permitido apenas aos desafios do vendedor autenticado." })
      return null
    }

    return authSkVendedor
  }

  if (!requestedSkVendedor) {
    res.status(400).json({ error: "sk_vendedor obrigatorio." })
    return null
  }

  if (empresaId) {
    const sellerUser = await findAuthUserBySkVendedor(requestedSkVendedor, empresaId)
    if (!sellerUser) {
      res.status(403).json({ error: "Vendedor fora da organizacao autenticada." })
      return null
    }
  }

  return requestedSkVendedor
}

export async function getDesafios(req, res) {
  try {
    const context = getChallengeContext(req, res)
    if (!context) return
    const data = await listChallenges(context)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao listar desafios.")
  }
}

export async function getDesafioMetadata(req, res) {
  try {
    const context = getChallengeContext(req, res)
    if (!context) return
    const data = await listChallengeMetadata(context)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao carregar metadados de desafios.")
  }
}

export async function getDesafioProdutosCatalogo(req, res) {
  try {
    const context = getChallengeContext(req, res)
    if (!context) return
    const data = await searchChallengeProducts(req.query.q ?? "", context)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao buscar produtos do desafio.")
  }
}

export async function getDesafioMarcasCatalogo(req, res) {
  try {
    const context = getChallengeContext(req, res)
    if (!context) return
    const data = await searchChallengeBrands(req.query.q ?? "", context)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao buscar marcas do desafio.")
  }
}

export async function getDesafioSetup(req, res) {
  try {
    const context = getChallengeContext(req, res)
    if (!context) return
    const data = await getChallengeModuleSetup(context)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao verificar inicializacao do modulo de desafios.")
  }
}

export async function postDesafioImpactPreview(req, res) {
  try {
    const context = getChallengeContext(req, res)
    if (!context) return
    const data = await previewChallengeImpact(req.body, context)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao calcular impacto estimado do desafio.")
  }
}

export async function postDesafio(req, res) {
  try {
    const context = getChallengeContext(req, res)
    if (!context) return
    const data = await createChallenge(req.body, context)
    return res.status(201).json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao criar desafio.")
  }
}

export async function getDesafioById(req, res) {
  try {
    const context = getChallengeContext(req, res)
    if (!context) return
    const data = await getChallengeById(req.params.id, context)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao buscar desafio.")
  }
}

export async function putDesafio(req, res) {
  try {
    const context = getChallengeContext(req, res)
    if (!context) return
    const data = await updateChallenge(req.params.id, req.body, context)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao atualizar desafio.")
  }
}

export async function deleteDesafio(req, res) {
  try {
    const context = getChallengeContext(req, res)
    if (!context) return
    const data = await closeChallenge(req.params.id, req.query.status ?? "ENCERRADO_MANUAL", context)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao encerrar desafio.")
  }
}

export async function getDesafioParticipantes(req, res) {
  try {
    const context = getChallengeContext(req, res)
    if (!context) return
    const data = await getChallengeParticipants(req.params.id, context)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao listar participantes.")
  }
}

export async function postAceitarDesafio(req, res) {
  try {
    const context = getChallengeContext(req, res)
    if (!context) return
    const skVendedor = await getSellerFromRequest(req, res, null, context.empresaId)
    if (!skVendedor) return
    const data = await acceptChallenge(req.params.id, skVendedor, context)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao aceitar desafio.")
  }
}

export async function postRecusarDesafio(req, res) {
  try {
    const context = getChallengeContext(req, res)
    if (!context) return
    const skVendedor = await getSellerFromRequest(req, res, null, context.empresaId)
    if (!skVendedor) return
    const data = await declineChallenge(req.params.id, skVendedor, context)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao recusar desafio.")
  }
}

export async function getDesafioProgresso(req, res) {
  try {
    const context = getChallengeContext(req, res)
    if (!context) return
    const role = getAuthRole(req)
    const sellerFilter = role === "VENDEDOR"
      ? await getSellerFromRequest(req, res, req.query.sk_vendedor ?? req.auth?.sk_vendedor, context.empresaId)
      : req.query.sk_vendedor ?? null
    if (role === "VENDEDOR" && !sellerFilter) return
    const data = await refreshChallengeProgress(req.params.id, sellerFilter, context)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao calcular progresso do desafio.")
  }
}

export async function getVendedorDesafios(req, res) {
  try {
    const context = getChallengeContext(req, res)
    if (!context) return
    const skVendedor = await getSellerFromRequest(req, res, req.params.sk_vendedor, context.empresaId)
    if (!skVendedor) return
    const data = await listSellerChallenges(skVendedor, "all", context)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao listar desafios do vendedor.")
  }
}

export async function getVendedorDesafiosAtivos(req, res) {
  try {
    const context = getChallengeContext(req, res)
    if (!context) return
    const skVendedor = await getSellerFromRequest(req, res, req.params.sk_vendedor, context.empresaId)
    if (!skVendedor) return
    const data = await listSellerChallenges(skVendedor, "ativos", context)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao listar desafios ativos.")
  }
}

export async function getVendedorDesafiosDisponiveis(req, res) {
  try {
    const context = getChallengeContext(req, res)
    if (!context) return
    const skVendedor = await getSellerFromRequest(req, res, req.params.sk_vendedor, context.empresaId)
    if (!skVendedor) return
    const data = await listSellerChallenges(skVendedor, "disponiveis", context)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao listar desafios disponiveis.")
  }
}

export async function getVendedorDesafiosNovos(req, res) {
  try {
    const context = getChallengeContext(req, res)
    if (!context) return
    const skVendedor = await getSellerFromRequest(req, res, req.params.sk_vendedor, context.empresaId)
    if (!skVendedor) return
    const data = await getSellerChallengeAlert(skVendedor, context)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao listar desafios novos.")
  }
}

export async function getVendedorDesafioDetalhe(req, res) {
  try {
    const context = getChallengeContext(req, res)
    if (!context) return
    const skVendedor = await getSellerFromRequest(req, res, req.params.sk_vendedor, context.empresaId)
    if (!skVendedor) return
    const data = await getSellerChallengeById(req.params.id, skVendedor, context)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao buscar detalhe do desafio do vendedor.")
  }
}

export async function postVisualizarDesafio(req, res) {
  try {
    const context = getChallengeContext(req, res)
    if (!context) return
    const skVendedor = await getSellerFromRequest(req, res, null, context.empresaId)
    if (!skVendedor) return
    const data = await markChallengeSeen(req.params.id, skVendedor, context)
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao registrar visualizacao do desafio.")
  }
}

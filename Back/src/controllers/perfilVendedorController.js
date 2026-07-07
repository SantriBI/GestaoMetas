import {
  createSellerProfile,
  getSellerProfile,
  updateSellerProfile,
} from "../services/objetivoVendedorService.js"
import { findAuthUserBySkVendedor } from "../services/authUsersService.js"
import { canUseGlobalEmpresaScope } from "../services/requestScope.js"

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

function getRequestedEmpresaId(req) {
  return req.query?.empresa_id ?? req.query?.empresaId ?? req.body?.empresa_id ?? req.body?.empresaId ?? null
}

function getSellerCodeFromBody(body) {
  return body?.sk_vendedor ?? body?.skVendedor ?? body?.vendedor_id ?? body?.vendedorId ?? null
}

async function getSellerScope(req, res, sellerCodeInput = null, { requireSeller = true } = {}) {
  const role = String(req.auth?.role ?? "").toUpperCase()
  const authEmpresaId = req.auth?.empresa_id ?? null
  const authSkVendedor = req.auth?.sk_vendedor ?? null
  const requestedEmpresaId = getRequestedEmpresaId(req)
  const sellerCode = sellerCodeInput ?? getSellerCodeFromBody(req.body)

  if (role === "VENDEDOR") {
    if (!authSkVendedor || !authEmpresaId) {
      res.status(403).json({ error: "Vendedor autenticado sem empresa vinculada." })
      return null
    }

    if (sellerCode && String(sellerCode) !== String(authSkVendedor)) {
      res.status(403).json({ error: "Acesso permitido apenas ao vendedor autenticado." })
      return null
    }

    return { sellerCode: authSkVendedor, empresaId: authEmpresaId }
  }

  if (role === "GERENTE") {
    if (!authEmpresaId) {
      res.status(403).json({ error: "Empresa do gerente nao encontrada." })
      return null
    }

    if (requireSeller && !sellerCode) {
      res.status(400).json({ error: "vendedor_id e obrigatorio." })
      return null
    }

    if (sellerCode) {
      const sellerUser = await findAuthUserBySkVendedor(sellerCode, authEmpresaId)
      if (!sellerUser) {
        res.status(403).json({ error: "Vendedor fora da organizacao do gerente." })
        return null
      }
    }

    return { sellerCode, empresaId: authEmpresaId }
  }

  if (canUseGlobalEmpresaScope(req)) {
    const empresaId = requestedEmpresaId ?? authEmpresaId ?? null
    if (empresaId && sellerCode) {
      const sellerUser = await findAuthUserBySkVendedor(sellerCode, empresaId)
      if (!sellerUser) {
        res.status(403).json({ error: "Vendedor fora da organizacao informada." })
        return null
      }
    }

    return { sellerCode, empresaId }
  }

  res.status(403).json({ error: "Acesso negado." })
  return null
}

function applyScopeToPayload(payload, scope) {
  return {
    ...(payload ?? {}),
    ...(scope?.sellerCode ? { sk_vendedor: scope.sellerCode, vendedor_id: scope.sellerCode } : {}),
    empresa_id: scope?.empresaId ?? null,
  }
}

export async function getPerfilVendedor(req, res) {
  try {
    const scope = await getSellerScope(req, res, req.params.vendedor_id)
    if (!scope) return
    const data = await getSellerProfile(scope.sellerCode, { empresa_id: scope.empresaId })
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao buscar perfil do vendedor.")
  }
}

export async function postPerfilVendedor(req, res) {
  try {
    const scope = await getSellerScope(req, res)
    if (!scope) return
    const data = await createSellerProfile(applyScopeToPayload(req.body, scope))
    return res.status(201).json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao criar perfil do vendedor.")
  }
}

export async function putPerfilVendedor(req, res) {
  try {
    const scope = await getSellerScope(req, res, null, { requireSeller: false })
    if (!scope) return
    const data = await updateSellerProfile(req.params.id, applyScopeToPayload(req.body, scope))
    return res.json(data)
  } catch (error) {
    return handleError(res, error, "Erro ao atualizar perfil do vendedor.")
  }
}

import { AUTH_COOKIE_NAME, verifyAuthToken } from "../auth/token.js"
import { findAuthUserById } from "../services/authUsersService.js"
import { assertSystemManagerOrganizationAccess } from "../services/gerenteSistemasService.js"
import { getRequestedEmpresaId } from "../services/requestScope.js"

export async function requireAuth(req, res, next) {
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME]
  const bearerToken = req.headers?.authorization?.replace(/^Bearer\s+/i, "")
  const token = cookieToken ?? bearerToken ?? null

  const claims = verifyAuthToken(token)
  if (!claims) {
    return res.status(401).json({ error: "Nao autenticado." })
  }

  try {
    const user = await findAuthUserById(claims.id_usuario ?? claims.sub, claims.empresa_id ?? null)
    if (!user || user.ativo !== "S") {
      return res.status(401).json({ error: "Sessao expirada." })
    }

    if (Number(user.token_version ?? 0) !== Number(claims.token_version ?? 0)) {
      return res.status(401).json({ error: "Sessao expirada." })
    }

    const role = user.role ?? claims.role
    const requestedEmpresaId = getRequestedEmpresaId(req)
    let scopedEmpresaId = user.empresa_id ?? claims.empresa_id ?? null

    if (String(role ?? "").toUpperCase() === "GERENTE_SISTEMAS" && requestedEmpresaId) {
      await assertSystemManagerOrganizationAccess(user.id_usuario ?? claims.id_usuario ?? claims.sub, requestedEmpresaId)
      scopedEmpresaId = requestedEmpresaId
    }

    req.auth = {
      ...claims,
      id_usuario: user.id_usuario ?? claims.id_usuario ?? claims.sub,
      sub: String(user.id_usuario ?? claims.sub ?? claims.id_usuario),
      nome: user.nome ?? user.nome_completo ?? claims.nome ?? claims.nome_completo ?? claims.login,
      nome_completo: user.nome_completo ?? user.nome ?? claims.nome_completo ?? claims.nome,
      login: user.login ?? claims.login,
      role,
      empresa_id: scopedEmpresaId,
      empresa_id_original: user.empresa_id ?? claims.empresa_id ?? null,
      sk_vendedor: user.sk_vendedor ?? claims.sk_vendedor ?? null,
      token_version: Number(user.token_version ?? claims.token_version ?? 0),
    }
  } catch (error) {
    if (error?.status) {
      return res.status(Number(error.status)).json({ error: error.message ?? "Acesso negado." })
    }
    console.error("Erro ao validar sessao:", error)
    return res.status(401).json({ error: "Sessao expirada." })
  }

  next()
}

export function requireRole(...roles) {
  const allowedRoles = roles.map((role) => String(role ?? "").toUpperCase())

  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: "Nao autenticado." })
    const role = String(req.auth.role ?? "").toUpperCase()
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: "Acesso negado." })
    }
    next()
  }
}


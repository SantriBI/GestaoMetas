import { AUTH_COOKIE_NAME, verifyAuthToken } from "../auth/token.js"
import { findAuthUserById } from "../services/authUsersService.js"

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
  } catch (error) {
    console.error("Erro ao validar sessao:", error)
    return res.status(401).json({ error: "Sessao expirada." })
  }

  req.auth = claims
  next()
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: "Nao autenticado." })
    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ error: "Acesso negado." })
    }
    next()
  }
}

export function isSuperAdmin(req) {
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME]
  const bearerToken = req.headers?.authorization?.replace(/^Bearer\s+/i, "")
  const token = cookieToken ?? bearerToken ?? null

  if (token) {
    const claims = verifyAuthToken(token)
    if (claims?.role === "SUPERADMIN") {
      req.auth = claims
      return true
    }
  }

  // Fallback: header x-user-role (para compatibilidade com cliente existente)
  const roleHeader = String(req.headers?.["x-user-role"] ?? "").trim().toUpperCase()
  return roleHeader === "SUPERADMIN"
}

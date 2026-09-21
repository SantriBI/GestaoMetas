import crypto from "node:crypto"

const VALID_ROLES = new Set(["SUPERADMIN", "ADMIN", "GERENTE", "VENDEDOR", "PAINEL", "INDUSTRIA", "GERENTE_SISTEMAS"])
const SECRET = process.env.AUTH_TOKEN_SECRET

if (!SECRET || SECRET.length < 32) {
  throw new Error(
    "AUTH_TOKEN_SECRET ausente ou muito curto (minimo 32 caracteres). " +
    "Gere com: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  )
}
const TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS ?? 43200)
const TTL_MS = TTL_SECONDS * 1000
const IS_PROD = process.env.NODE_ENV === "production"

export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "sip_auth"
const AUTH_COOKIE_SAME_SITE = process.env.AUTH_COOKIE_SAME_SITE ?? "lax"

function b64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

function sign(data) {
  return b64url(crypto.createHmac("sha256", SECRET).update(data).digest())
}

export function issueAuthToken(user) {
  const header = b64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })))
  const payload = b64url(
    Buffer.from(
      JSON.stringify({
        sub: String(user.id_usuario),
        id_usuario: user.id_usuario,
        login: user.login,
        nome: user.nome ?? user.nome_completo ?? "",
        role: user.role,
        empresa_id: user.empresa_id ?? null,
        sk_vendedor: user.sk_vendedor ?? null,
        token_version: Number(user.token_version ?? 0),
        marca: user.marca ?? null,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor((Date.now() + TTL_MS) / 1000),
      })
    )
  )
  const signature = sign(`${header}.${payload}`)
  return `${header}.${payload}.${signature}`
}

export function verifyAuthToken(token) {
  if (!token || typeof token !== "string") return null
  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [header, payload, sig] = parts
  const expected = Buffer.from(sign(`${header}.${payload}`))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null

  let claims
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  } catch {
    return null
  }

  if (!claims || typeof claims !== "object") return null
  if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) return null
  if (!VALID_ROLES.has(claims.role)) return null

  return claims
}

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: AUTH_COOKIE_SAME_SITE,
    path: "/",
    maxAge: TTL_MS,
  }
}

export function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions())
}

export function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, { path: "/" })
}

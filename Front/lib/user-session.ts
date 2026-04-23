"use client"

export type UserRole = "VENDEDOR" | "GERENTE" | "INDUSTRIA"

export interface AuthUser {
  id_usuario: number | string
  nome: string
  NOME?: string
  login: string
  role: UserRole
  empresa_id?: number | string | null
  sk_empresa?: number | string | null
  sk_vendedor?: number | string | null
  marca?: string | null
  foto_url?: string | null
  senha_temporaria?: string | null
}

const USER_STORAGE_KEY = "user"
const USER_UPDATED_EVENT = "user-updated"

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null

  const raw = sessionStorage.getItem(USER_STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function setStoredUser(user: AuthUser) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
  sessionStorage.setItem("usuario_nome", String(user.nome ?? "").trim())
  window.dispatchEvent(new CustomEvent(USER_UPDATED_EVENT))
}

export function updateStoredUser(patch: Partial<AuthUser>) {
  const current = getStoredUser()
  if (!current) return
  setStoredUser({ ...current, ...patch })
}

export function clearStoredUser() {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(USER_STORAGE_KEY)
  sessionStorage.removeItem("usuario_nome")
  window.dispatchEvent(new CustomEvent(USER_UPDATED_EVENT))
}

export function onStoredUserChange(callback: () => void) {
  if (typeof window === "undefined") return () => {}

  const handler = () => callback()
  window.addEventListener(USER_UPDATED_EVENT, handler)
  return () => window.removeEventListener(USER_UPDATED_EVENT, handler)
}

export function getDashboardRoute(role?: string | null) {
  if (role === "VENDEDOR") return "/vendedor"
  if (role === "INDUSTRIA") return "/industria"
  return "/dashboard"
}

export function getUserInitials(nome?: string | null) {
  const partes = String(nome ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  if (!partes.length) return "US"
  return partes.map((parte) => parte[0]?.toUpperCase() ?? "").join("")
}

export function getDefaultAvatarUrl(nome?: string | null) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(String(nome ?? "Usuario"))}&background=0f172a&color=f8fafc`
}

export function getUserAvatarSrc(user?: Pick<AuthUser, "foto_url" | "nome"> | null) {
  if (user?.foto_url?.trim()) {
    return user.foto_url
  }

  return getDefaultAvatarUrl(user?.nome)
}

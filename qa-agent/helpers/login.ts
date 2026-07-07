import type { APIRequestContext, Cookie } from "@playwright/test"
import { env, type RoleCredential } from "../config/env"

export type UserRole = "VENDEDOR" | "GERENTE" | "INDUSTRIA" | "ADMIN" | "SUPERADMIN"

export interface AuthUser {
  id_usuario: number | string
  nome: string
  NOME?: string
  login: string
  role: UserRole
  empresa_id?: number | string | null
  sk_empresa?: number | string | null
  sk_vendedor?: number | string | null
  foto_url?: string | null
  senha_temporaria?: string | null
}

export interface LoginResult {
  user: AuthUser
  cookies: Cookie[]
}

/**
 * Loga via POST /api/login (mesma rota usada pelo formulario real) e devolve
 * o usuario retornado + os cookies de sessao emitidos (cookie httpOnly "sip_auth").
 * Usado pela fixture de auth para "hidratar" um contexto do browser sem
 * precisar preencher o formulario de login em toda spec.
 */
export async function loginViaApi(request: APIRequestContext, credential: RoleCredential): Promise<LoginResult> {
  const response = await request.post(`${env.baseUrl}/api/login`, {
    data: { login: credential.login, senha: credential.senha },
  })

  if (!response.ok()) {
    const body = await response.text().catch(() => "")
    throw new Error(
      `[qa-agent] Falha ao autenticar via API para o papel ${credential.role} ` +
        `(status ${response.status()}). Resposta: ${body}`
    )
  }

  const user = (await response.json()) as AuthUser

  if (user.senha_temporaria === "S") {
    throw new Error(
      `[qa-agent] O usuario de teste do papel ${credential.role} esta com senha temporaria ` +
        `pendente de troca. Troque a senha manualmente antes de rodar o QA.`
    )
  }

  const state = await request.storageState()
  const host = new URL(env.baseUrl).hostname
  const cookies = state.cookies.filter((cookie) => cookie.domain === host || cookie.domain === `.${host}`)

  return { user, cookies }
}

import { test as base, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test"
import { requireCredential, type QaRole } from "../config/env"
import { loginViaApi, type AuthUser, type LoginResult } from "../helpers/login"
import { attachDiagnostics, finalizeDiagnostics } from "../helpers/error-capture"

/**
 * Cache de login por papel, compartilhado entre os testes de um mesmo worker.
 * O Playwright.storageState nativo persiste cookies + localStorage, mas NAO
 * sessionStorage (onde esta app guarda o usuario) — por isso o login e feito
 * uma vez via API e replicado manualmente em cada novo BrowserContext.
 */
const loginCache = new Map<QaRole, Promise<LoginResult>>()

function getLogin(request: APIRequestContext, role: QaRole): Promise<LoginResult> {
  const cached = loginCache.get(role)
  if (cached) return cached

  const credential = requireCredential(role)
  const promise = loginViaApi(request, credential)
  loginCache.set(role, promise)
  return promise
}

async function hydrateContext(context: BrowserContext, login: LoginResult): Promise<void> {
  if (login.cookies.length) {
    await context.addCookies(login.cookies)
  }

  await context.addInitScript((user: AuthUser) => {
    window.sessionStorage.setItem("user", JSON.stringify(user))
    window.sessionStorage.setItem("usuario_nome", String(user.nome ?? "").trim())
  }, login.user)
}

interface AuthFixtures {
  gerenteUser: AuthUser
  vendedorUser: AuthUser
  gerentePage: Page
  vendedorPage: Page
}

export const test = base.extend<AuthFixtures>({
  gerenteUser: async ({ request }, use) => {
    const login = await getLogin(request, "GERENTE")
    await use(login.user)
  },

  vendedorUser: async ({ request }, use) => {
    const login = await getLogin(request, "VENDEDOR")
    await use(login.user)
  },

  gerentePage: async ({ browser, request }, use, testInfo) => {
    const login = await getLogin(request, "GERENTE")
    const context = await browser.newContext()
    await hydrateContext(context, login)
    const page = await context.newPage()
    attachDiagnostics(page)

    await use(page)

    await finalizeDiagnostics(page, testInfo)
    await context.close()
  },

  vendedorPage: async ({ browser, request }, use, testInfo) => {
    const login = await getLogin(request, "VENDEDOR")
    const context = await browser.newContext()
    await hydrateContext(context, login)
    const page = await context.newPage()
    attachDiagnostics(page)

    await use(page)

    await finalizeDiagnostics(page, testInfo)
    await context.close()
  },
})

export { expect } from "@playwright/test"

import { test, expect } from "@playwright/test"

/**
 * Nao existe middleware.ts nesta app: cada pagina protegida le sessionStorage
 * no client e redireciona para /login se nao houver usuario. Por isso testamos
 * pagina a pagina em vez de confiar em um guard central.
 *
 * Confirmado por leitura direta do codigo (nao apenas por relato de terceiros):
 * "/", "/alterar-senha" e "/industria" NAO exigem sessao — ficaram de fora de proposito.
 */
const PROTECTED_ROUTES = [
  "/dashboard",
  "/vendedor",
  "/vendedor/desafios",
  "/vendedor/minha-meta-de-vida",
  "/area-ataque",
  "/investigar-cliente",
  "/ativacao-clientes",
  "/perfil",
  "/admin",
  "/admin/organizacoes",
  "/usuarios",
  "/desafios",
  "/feed",
]

test.describe("Protecao de rotas sem sessao", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`acessar ${route} sem sessao redireciona para /login`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
    })
  }
})

test.describe("Paginas publicas nao redirecionam sem sessao", () => {
  const PUBLIC_ROUTES = ["/", "/alterar-senha", "/industria", "/como-funciona"]

  for (const route of PUBLIC_ROUTES) {
    test(`acessar ${route} sem sessao NAO redireciona para /login`, async ({ page }) => {
      await page.goto(route)
      await expect(page).not.toHaveURL(/\/login/)
    })
  }
})

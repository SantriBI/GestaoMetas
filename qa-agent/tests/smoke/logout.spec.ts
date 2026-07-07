import { test, expect } from "../../fixtures/auth.fixture"
import { logoutAndAssertLoggedOut } from "../../helpers/logout"

test("logout do gerente limpa a sessao e redireciona para /login", async ({ gerentePage }) => {
  await gerentePage.goto("/dashboard")
  await expect(gerentePage).toHaveURL(/\/dashboard/)

  await logoutAndAssertLoggedOut(gerentePage)
})

test("logout do vendedor limpa a sessao e redireciona para /login", async ({ vendedorPage }) => {
  await vendedorPage.goto("/vendedor")
  await expect(vendedorPage).toHaveURL(/\/vendedor/)

  await logoutAndAssertLoggedOut(vendedorPage)
})

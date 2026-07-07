import { test, expect } from "@playwright/test"
import { requireCredential, type QaRole } from "../../config/env"
import { LoginPage } from "../../pages/LoginPage"
import { attachDiagnostics, finalizeDiagnostics } from "../../helpers/error-capture"
import { expectPageNotBlank } from "../../utils/assertions"

const ROLES_AND_TARGETS: Array<{ role: QaRole; targetUrlPattern: RegExp }> = [
  { role: "GERENTE", targetUrlPattern: /\/dashboard/ },
  { role: "VENDEDOR", targetUrlPattern: /\/vendedor/ },
]

test.describe("Login", () => {
  test.beforeEach(async ({ page }) => {
    attachDiagnostics(page)
  })

  test.afterEach(async ({ page }, testInfo) => {
    await finalizeDiagnostics(page, testInfo)
  })

  for (const { role, targetUrlPattern } of ROLES_AND_TARGETS) {
    test(`login com sucesso como ${role} redireciona para a area correta`, async ({ page }) => {
      const credential = requireCredential(role)
      const loginPage = new LoginPage(page)

      await loginPage.open()
      await loginPage.login(credential.login, credential.senha)

      await expect(page).toHaveURL(targetUrlPattern, { timeout: 15000 })
      await expectPageNotBlank(page)
    })
  }

  test("login com senha incorreta mostra mensagem de erro e permanece em /login", async ({ page }) => {
    const credential = requireCredential("GERENTE")
    const loginPage = new LoginPage(page)

    await loginPage.open()
    await loginPage.login(credential.login, "senha-incorreta-qa-agent")

    await expect(loginPage.errorMessage).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test("login com usuario inexistente mostra mensagem de erro", async ({ page }) => {
    const loginPage = new LoginPage(page)

    await loginPage.open()
    await loginPage.login("00000000000", "qualquer-senha")

    await expect(loginPage.errorMessage).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })
})

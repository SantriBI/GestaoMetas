import type { Page, TestInfo } from "@playwright/test"
import { test, expect } from "../../fixtures/auth.fixture"
import { AppShellNav } from "../../pages/AppShellNav"
import { captureScreenshot } from "../../helpers/screenshot"
import { resetDiagnostics } from "../../helpers/error-capture"
import { waitForNoSpinner } from "../../helpers/wait"
import { expectNoErrors, expectPageNotBlank } from "../../utils/assertions"

/**
 * Simula um usuario real percorrendo todas as paginas alcancaveis pelo menu do
 * seu papel: le os links realmente renderizados pelo AppShellNav (em vez de uma
 * lista fixa) e, para cada um, valida que a pagina carregou de verdade.
 */
async function crawlAndValidate(page: Page, testInfo: TestInfo, roleLabel: string) {
  const nav = new AppShellNav(page)
  const links = await nav.listVisibleLinks()

  const uniqueHrefs = [...new Map(links.map((link) => [link.href, link])).values()]
  expect(uniqueHrefs.length, "Nenhum link de navegacao foi encontrado no AppShellNav").toBeGreaterThan(0)

  for (const link of uniqueHrefs) {
    await test.step(`visita ${link.label} (${link.href})`, async () => {
      resetDiagnostics(page)
      await page.goto(link.href)
      await waitForNoSpinner(page)

      await expectPageNotBlank(page)
      await captureScreenshot(page, testInfo, `${roleLabel}-${link.label}`)
      expectNoErrors(page)
    })
  }
}

test("gerente consegue navegar por todas as paginas do menu sem erros", async ({ gerentePage }, testInfo) => {
  await gerentePage.goto("/dashboard")
  await crawlAndValidate(gerentePage, testInfo, "gerente")
})

test("vendedor consegue navegar por todas as paginas do menu sem erros", async ({ vendedorPage }, testInfo) => {
  await vendedorPage.goto("/vendedor")
  await crawlAndValidate(vendedorPage, testInfo, "vendedor")
})

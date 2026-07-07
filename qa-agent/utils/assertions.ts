import { expect, type Page } from "@playwright/test"
import { getDiagnostics } from "../helpers/error-capture"

/**
 * Usa expect.soft de proposito: o requisito do framework e "nao parar na
 * primeira falha, continuar ate o final" — assercoes soft marcam o teste como
 * falho mas deixam o restante do fluxo (ex.: o crawler visitando outras
 * paginas) continuar rodando.
 */
export function expectNoConsoleErrors(page: Page): void {
  const diagnostics = getDiagnostics(page)
  expect.soft(
    diagnostics.consoleErrors,
    `Erros de console encontrados:\n${diagnostics.consoleErrors.map((e) => e.text).join("\n")}`
  ).toEqual([])
}

export function expectNoPageErrors(page: Page): void {
  const diagnostics = getDiagnostics(page)
  expect.soft(diagnostics.pageErrors, `Erros JS nao tratados:\n${diagnostics.pageErrors.join("\n")}`).toEqual([])
}

export function expectNoHttpErrors(page: Page): void {
  const diagnostics = getDiagnostics(page)
  const summary = diagnostics.httpErrors.map((e) => `${e.status} ${e.method} ${e.url}`).join("\n")
  expect.soft(diagnostics.httpErrors, `Respostas HTTP de erro em /api:\n${summary}`).toEqual([])
}

export async function expectPageNotBlank(page: Page): Promise<void> {
  const bodyText = await page.locator("body").innerText()
  expect
    .soft(bodyText.trim().length, "A pagina parece estar em branco (sem texto visivel no body)")
    .toBeGreaterThan(0)
}

/** Roda as 3 verificacoes de saude de pagina de uma vez: console, JS e HTTP. */
export function expectNoErrors(page: Page): void {
  expectNoConsoleErrors(page)
  expectNoPageErrors(page)
  expectNoHttpErrors(page)
}

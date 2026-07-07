import { expect, type Page } from "@playwright/test"
import { AppShellNav } from "../pages/AppShellNav"

/** Clica em "Sair" e confirma que a sessao foi limpa e o usuario voltou para /login. */
export async function logoutAndAssertLoggedOut(page: Page): Promise<void> {
  const nav = new AppShellNav(page)
  await nav.logout()

  await expect(page).toHaveURL(/\/login/)

  const storedUser = await page.evaluate(() => window.sessionStorage.getItem("user"))
  expect(storedUser, "sessionStorage ainda contem o usuario apos logout").toBeNull()
}

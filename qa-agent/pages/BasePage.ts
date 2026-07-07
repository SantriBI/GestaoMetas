import type { Page } from "@playwright/test"
import { AppShellNav } from "./AppShellNav"

/** Base para Page Objects de paginas autenticadas: navegacao + acesso ao shell comum. */
export class BasePage {
  readonly page: Page
  readonly nav: AppShellNav

  constructor(page: Page) {
    this.page = page
    this.nav = new AppShellNav(page)
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path)
  }

  async bodyText(): Promise<string> {
    return (await this.page.locator("body").innerText()).trim()
  }
}

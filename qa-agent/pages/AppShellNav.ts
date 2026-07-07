import type { Page, Locator } from "@playwright/test"

export interface NavLink {
  label: string
  href: string
}

/**
 * Representa a barra de navegacao comum (Front/components/layout/AppShellNav.tsx),
 * compartilhada por todas as paginas autenticadas. Le os links realmente
 * renderizados em vez de manter uma lista fixa, para acompanhar mudancas de menu.
 */
export class AppShellNav {
  readonly page: Page
  readonly root: Locator

  constructor(page: Page) {
    this.page = page
    this.root = page.locator("nav")
  }

  link(label: string): Locator {
    return this.root.getByRole("link", { name: label, exact: true })
  }

  async goTo(label: string): Promise<void> {
    await this.link(label).first().click()
  }

  get logoutButton(): Locator {
    return this.root.getByRole("button", { name: "Sair" })
  }

  async logout(): Promise<void> {
    await this.logoutButton.click()
  }

  /** Lista os links de navegacao visiveis (label + href), na ordem em que aparecem no DOM. */
  async listVisibleLinks(): Promise<NavLink[]> {
    const links = this.root.getByRole("link")
    const count = await links.count()
    const result: NavLink[] = []

    for (let index = 0; index < count; index += 1) {
      const link = links.nth(index)
      const label = (await link.innerText()).trim()
      const href = await link.getAttribute("href")
      if (label && href) {
        result.push({ label, href })
      }
    }

    return result
  }
}

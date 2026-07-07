import { expect, type Page, type Locator } from "@playwright/test"

/** Page Object da tela de login (Front/app/login/page.tsx). Sem shell/nav, por isso nao herda de BasePage. */
export class LoginPage {
  readonly page: Page
  readonly loginInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator
  readonly togglePasswordButton: Locator

  constructor(page: Page) {
    this.page = page
    this.loginInput = page.locator("#login")
    this.passwordInput = page.locator("#password")
    this.submitButton = page.getByRole("button", { name: "Entrar" })
    // A app nao usa data-testid; a classe "text-destructive" e o unico marcador estavel da mensagem de erro.
    this.errorMessage = page.locator(".text-destructive")
    this.togglePasswordButton = page.getByRole("button", { name: /Mostrar senha|Ocultar senha/ })
  }

  async open(): Promise<void> {
    await this.page.goto("/login")
    await expect(this.loginInput).toBeVisible()
  }

  async login(login: string, senha: string): Promise<void> {
    await this.loginInput.fill(login)
    await this.passwordInput.fill(senha)
    await this.submitButton.click()
  }
}

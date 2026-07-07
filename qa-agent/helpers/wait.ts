import { expect, type Page, type Locator } from "@playwright/test"

/** Espera um toast (sonner) aparecer, opcionalmente filtrando por texto, e devolve o locator. */
export async function waitForToast(page: Page, textOrPattern?: string | RegExp): Promise<Locator> {
  const toasts = page.locator("[data-sonner-toast]")
  const toast = textOrPattern ? toasts.filter({ hasText: textOrPattern }) : toasts

  await expect(toast.first()).toBeVisible({ timeout: 10000 })
  return toast.first()
}

/** Espera qualquer spinner de carregamento visivel na pagina desaparecer (se existir). */
export async function waitForNoSpinner(page: Page): Promise<void> {
  const spinner = page.locator(".animate-spin").first()
  const isVisible = await spinner.isVisible().catch(() => false)
  if (!isVisible) return

  await spinner.waitFor({ state: "hidden", timeout: 15000 }).catch(() => {
    // Alguns spinners decorativos ficam sempre montados (ex.: ícone girando fixo);
    // nesse caso seguimos em frente em vez de falhar o teste por isso.
  })
}

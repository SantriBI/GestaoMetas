import type { Page, TestInfo } from "@playwright/test"

/** Tira um screenshot de pagina inteira e anexa ao relatorio HTML do Playwright. */
export async function captureScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const buffer = await page.screenshot({ fullPage: true })
  await testInfo.attach(name.endsWith(".png") ? name : `${name}.png`, {
    body: buffer,
    contentType: "image/png",
  })
}

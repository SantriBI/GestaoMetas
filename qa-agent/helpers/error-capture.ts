import type { Page, TestInfo } from "@playwright/test"

export interface CapturedConsoleMessage {
  type: string
  text: string
  location?: string
}

export interface CapturedHttpError {
  method: string
  url: string
  status: number
}

export interface NetworkLogEntry {
  method: string
  url: string
  status: number
}

export interface DiagnosticsCollector {
  consoleErrors: CapturedConsoleMessage[]
  consoleWarnings: CapturedConsoleMessage[]
  pageErrors: string[]
  httpErrors: CapturedHttpError[]
  networkLog: NetworkLogEntry[]
}

const collectors = new WeakMap<Page, DiagnosticsCollector>()

/**
 * Anexa listeners de console/pageerror/response numa page e guarda tudo num
 * coletor por-page. Deve ser chamado uma vez por page, assim que ela e criada
 * (normalmente dentro de uma fixture), antes de qualquer navegacao do teste.
 */
export function attachDiagnostics(page: Page): DiagnosticsCollector {
  const collector: DiagnosticsCollector = {
    consoleErrors: [],
    consoleWarnings: [],
    pageErrors: [],
    httpErrors: [],
    networkLog: [],
  }
  collectors.set(page, collector)

  page.on("console", (message) => {
    const entry: CapturedConsoleMessage = {
      type: message.type(),
      text: message.text(),
      location: message.location()?.url,
    }
    if (message.type() === "error") collector.consoleErrors.push(entry)
    if (message.type() === "warning") collector.consoleWarnings.push(entry)
  })

  page.on("pageerror", (error) => {
    collector.pageErrors.push(error.stack || error.message)
  })

  page.on("response", (response) => {
    const url = response.url()
    if (!url.includes("/api/")) return

    const entry: NetworkLogEntry = {
      method: response.request().method(),
      url,
      status: response.status(),
    }
    collector.networkLog.push(entry)

    if (entry.status >= 400) {
      collector.httpErrors.push(entry)
    }
  })

  return collector
}

/**
 * Limpa o coletor de uma page sem remover os listeners — util entre navegacoes
 * dentro do mesmo teste (ex.: o crawler), para que os erros de uma pagina nao
 * "vazem" para a checagem da proxima.
 */
export function resetDiagnostics(page: Page): void {
  const collector = getDiagnostics(page)
  collector.consoleErrors.length = 0
  collector.consoleWarnings.length = 0
  collector.pageErrors.length = 0
  collector.httpErrors.length = 0
  collector.networkLog.length = 0
}

/** Le o coletor de diagnosticos de uma page (deve ter sido inicializado por attachDiagnostics). */
export function getDiagnostics(page: Page): DiagnosticsCollector {
  const existing = collectors.get(page)
  if (!existing) {
    throw new Error(
      "[qa-agent] Diagnosticos nao inicializados para esta page. Chame attachDiagnostics(page) antes de usar."
    )
  }
  return existing
}

/**
 * Anexa evidencias ao relatorio HTML quando algo relevante foi capturado.
 * Chamar no teardown da fixture (depois de "await use(page)", antes de fechar o contexto)
 * para que o testInfo ainda esteja valido.
 */
export async function finalizeDiagnostics(page: Page, testInfo: TestInfo): Promise<void> {
  const collector = collectors.get(page)
  if (!collector) return

  const hasIssues =
    collector.consoleErrors.length > 0 || collector.pageErrors.length > 0 || collector.httpErrors.length > 0

  if (!hasIssues) return

  await testInfo.attach("qa-agent-diagnostics.json", {
    body: JSON.stringify(
      {
        url: page.url(),
        timestamp: new Date().toISOString(),
        consoleErrors: collector.consoleErrors,
        pageErrors: collector.pageErrors,
        httpErrors: collector.httpErrors,
      },
      null,
      2
    ),
    contentType: "application/json",
  })
}

import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter"
import { mkdirSync, writeFileSync, copyFileSync } from "fs"
import { join } from "path"

const ROOT = join(__dirname, "..")
const LOGS_DIR = join(ROOT, "logs")
const SCREENSHOTS_DIR = join(ROOT, "screenshots")
const VIDEOS_DIR = join(ROOT, "videos")

interface TestSummary {
  title: string
  file: string
  status: string
  durationMs: number
}

function safeName(input: string): string {
  return input.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase()
}

/**
 * Reporter complementar ao HTML nativo do Playwright: grava um resumo em JSON
 * (logs/run-summary.json) com contagem, tempo por teste e cobertura, e espelha
 * screenshots/videos em pastas simples (screenshots/, videos/) para navegacao
 * rapida sem precisar abrir o relatorio HTML.
 */
export default class SummaryReporter implements Reporter {
  private tests: TestSummary[] = []
  private startedAt = 0

  onBegin(): void {
    this.startedAt = Date.now()
    mkdirSync(LOGS_DIR, { recursive: true })
    mkdirSync(SCREENSHOTS_DIR, { recursive: true })
    mkdirSync(VIDEOS_DIR, { recursive: true })
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.tests.push({
      title: test.titlePath().slice(1).join(" > "),
      file: test.location.file,
      status: result.status,
      durationMs: result.duration,
    })

    const testSlug = safeName(test.titlePath().slice(1).join("-"))

    for (const attachment of result.attachments) {
      const isScreenshot = attachment.contentType === "image/png"
      const isVideo = attachment.contentType === "video/webm"
      if (!isScreenshot && !isVideo) continue

      const dir = isScreenshot ? SCREENSHOTS_DIR : VIDEOS_DIR
      const ext = isScreenshot ? ".png" : ".webm"
      const dest = join(dir, `${testSlug}-${safeName(attachment.name)}${ext}`)

      if (attachment.path) {
        this.copySafely(attachment.path, dest)
      } else if (attachment.body) {
        this.writeSafely(dest, attachment.body)
      }
    }
  }

  private copySafely(source: string, dest: string): void {
    try {
      copyFileSync(source, dest)
    } catch {
      // Artefato pode nao existir mais (ex.: limpo em um retry); nao e critico para o resumo.
    }
  }

  private writeSafely(dest: string, body: Buffer): void {
    try {
      writeFileSync(dest, body)
    } catch {
      // Mesma tolerancia do copySafely.
    }
  }

  onEnd(result: FullResult): void {
    const totalDurationMs = Date.now() - this.startedAt
    const passed = this.tests.filter((t) => t.status === "passed").length
    const failed = this.tests.filter((t) => t.status === "failed" || t.status === "timedOut").length
    const skipped = this.tests.filter((t) => t.status === "skipped").length

    const summary = {
      generatedAt: new Date().toISOString(),
      status: result.status,
      totalTests: this.tests.length,
      passed,
      failed,
      skipped,
      totalDurationMs,
      tests: [...this.tests].sort((a, b) => b.durationMs - a.durationMs),
    }

    writeFileSync(join(LOGS_DIR, "run-summary.json"), JSON.stringify(summary, null, 2), "utf-8")

    console.log(
      `\n[qa-agent] ${passed}/${this.tests.length} passaram, ${failed} falharam, ${skipped} pulados ` +
        `em ${(totalDurationMs / 1000).toFixed(1)}s.\n` +
        `Resumo: qa-agent/logs/run-summary.json | Relatorio HTML: qa-agent/reports/index.html\n`
    )
  }
}

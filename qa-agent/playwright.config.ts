import { defineConfig, devices } from "@playwright/test"
import { env } from "./config/env"

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: env.workers ? Number(env.workers) : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "reports", open: "never" }],
    ["./reporters/summary-reporter.ts"],
  ],
  outputDir: "test-results",
  timeout: env.defaultTimeoutMs * 2,
  expect: {
    timeout: env.defaultTimeoutMs,
  },
  use: {
    baseURL: env.baseUrl,
    headless: env.headless,
    actionTimeout: env.actionTimeoutMs,
    navigationTimeout: env.navigationTimeoutMs,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    launchOptions: env.slowMoMs ? { slowMo: env.slowMoMs } : undefined,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})

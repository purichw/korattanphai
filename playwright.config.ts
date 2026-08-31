import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173";
const hasExplicitBaseURL = Boolean(process.env.PLAYWRIGHT_BASE_URL);
const isCodexSandbox =
  Boolean(process.env.CODEX_SANDBOX) || process.env.CODEX_SANDBOX_NETWORK_DISABLED === "1";
const shouldStartWebServer =
  process.env.PLAYWRIGHT_START_WEB_SERVER === "1" ||
  (!hasExplicitBaseURL && !isCodexSandbox && process.env.PLAYWRIGHT_SKIP_WEB_SERVER !== "1");

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  webServer: shouldStartWebServer
    ? {
        command: "npm run dev:e2e",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 960 } },
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 5"],
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});

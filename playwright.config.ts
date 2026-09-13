import { defineConfig, devices } from "@playwright/test";

// Les trois recettes du brief tournent sur le serveur de dev (port 3100) avec une base reseedée.
export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./tests/global-setup.ts",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3100",
    locale: "fr-FR",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.BASE_URL ? undefined : { command: "NEXT_DIST_DIR=.next-test npm run dev -- -p 3100", url: "http://localhost:3100/portefeuille", reuseExistingServer: true, timeout: 120_000 },
});

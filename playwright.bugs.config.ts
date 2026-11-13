import { defineConfig, devices } from "@playwright/test";

// Exploratory bug hunt against a local production build: npx playwright test -c playwright.bugs.config.ts
export default defineConfig({
  testDir: "tests/bugs",
  timeout: 300_000,
  webServer: { command: "npm run build && npx next start -p 3100", url: "http://localhost:3100/api/health", timeout: 240_000, reuseExistingServer: false, env: { INTEGRATION_API_KEY: "e2e-integration-key", NLP_SERVICE_URL: "http://localhost:8090" } },
  use: { ...devices["Desktop Chrome"] },
});

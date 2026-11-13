import { defineConfig, devices } from "@playwright/test";

// One-off: drive the public CDS Hooks sandbox against the deployed service. npx playwright test -c playwright.sandbox.config.ts
export default defineConfig({ testDir: "tests/sandbox", timeout: 180_000, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } });

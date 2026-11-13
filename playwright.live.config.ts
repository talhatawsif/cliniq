import { defineConfig } from "@playwright/test";

// One-off check of the deployed app: npx playwright test -c playwright.live.config.ts
export default defineConfig({
  testDir: "tests/live",
  use: { baseURL: process.env.LIVE_URL ?? "https://cliniq-inky-ten.vercel.app" },
});

import { defineConfig } from "@playwright/test";

// Records the demo videos against the deployed app: npx playwright test -c playwright.video.config.ts
// Output: docs/video/*.webm (the test copies the recording there).
export default defineConfig({
  testDir: "tests/video",
  timeout: 900_000,
  outputDir: "test-results/video",
  use: {
    baseURL: process.env.APP_URL ?? "https://cliniq-inky-ten.vercel.app",
    viewport: { width: 1280, height: 720 },
    video: { mode: "on", size: { width: 1280, height: 720 } },
  },
});

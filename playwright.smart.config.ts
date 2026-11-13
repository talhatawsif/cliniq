import { defineConfig, devices } from "@playwright/test";

// Real SMART launch against launch.smarthealthit.org (needs internet): npm run e2e:smart
// APP_URL=https://... runs it against a deployed app instead of a local build.
const live = process.env.APP_URL;
export default defineConfig({
  testDir: "tests/smart",
  timeout: 120_000,
  webServer: live
    ? undefined
    : {
        command: "npm run build && npx next start -p 3100",
        url: "http://localhost:3100/api/health",
        timeout: 240_000,
        reuseExistingServer: true,
      },
  use: { ...devices["Desktop Chrome"], baseURL: live ?? "http://localhost:3100" },
});

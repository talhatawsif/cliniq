import { defineConfig, devices } from "@playwright/test";

// Runs against the local Docker HAPI (npm run load first). FHIR_BASE_URL and the Supabase keys come from .env.local.
export default defineConfig({
  testDir: "tests/e2e",
  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100/api/health",
    timeout: 240_000,
  },
  use: { baseURL: "http://localhost:3100" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "signed-in",
      testIgnore: [/auth\.setup\.ts/, /security\.spec\.ts/],
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "tests/e2e/.auth.json" },
    },
    {
      name: "anonymous",
      testMatch: /security\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

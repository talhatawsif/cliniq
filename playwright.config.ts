import { defineConfig } from "@playwright/test";

// Runs against the local Docker HAPI (npm run load first). FHIR_BASE_URL comes from .env.local.
export default defineConfig({
  testDir: "tests/e2e",
  webServer: {
    command: "npm run build && npx next start -p 3100",
    url: "http://localhost:3100/api/health",
    timeout: 240_000,
  },
  use: { baseURL: "http://localhost:3100" },
});

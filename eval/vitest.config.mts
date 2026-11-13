import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Evaluation runs (they call real services): npm run assistant:eval
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../src", import.meta.url)),
      "server-only": fileURLToPath(new URL("../tests/stubs/empty.ts", import.meta.url)),
    },
  },
  test: { include: ["eval/**/*.eval.ts"], testTimeout: 600_000 },
});

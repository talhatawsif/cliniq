import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/empty.ts", import.meta.url)),
    } },
  test: { include: ["src/**/*.test.ts", "tests/**/*.test.ts", "scripts/**/*.test.ts"] },
});

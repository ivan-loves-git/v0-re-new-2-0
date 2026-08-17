import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/__tests__/**/*.test.ts", "lib/**/*.test.ts"],
    setupFiles: ["./lib/__tests__/setup-env.ts"],
    exclude: [
      "node_modules/**",
      ".next/**",
      ".claude/**",
      "_archive/**",
      "scripts/e2e-tests/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["lib/**/*.ts"],
      exclude: ["lib/**/__tests__/**", "lib/types/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "server-only": path.resolve(__dirname, "./lib/__tests__/server-only.ts"),
    },
  },
});

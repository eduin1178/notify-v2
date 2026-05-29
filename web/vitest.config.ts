import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // env.ts valida TODAS las variables al importarse; cualquier test que
    // importe un módulo que use `env` necesita estos valores presentes.
    env: {
      DATABASE_URL: "postgres://user:pass@localhost:5432/test",
      BETTER_AUTH_SECRET: "x".repeat(32),
      BETTER_AUTH_URL: "http://localhost:3000",
      GOOGLE_CLIENT_ID: "test",
      GOOGLE_CLIENT_SECRET: "test",
      GITHUB_CLIENT_ID: "test",
      GITHUB_CLIENT_SECRET: "test",
      RESEND_API_KEY: "test",
      RESEND_FROM_EMAIL: "test@example.com",
      KAPSO_API_KEY: "test-key",
      KAPSO_WEBHOOK_SECRET: "test-webhook-secret",
    },
  },
  resolve: {
    alias: {
      // Espeja el alias `@/*` → `web/*` de tsconfig.json.
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});

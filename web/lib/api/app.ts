import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";

import type { HonoEnv } from "@/lib/api/context";
import { notFoundHandler, onError } from "@/lib/api/errors";
import { v1Router } from "@/lib/api/routes/v1";

const isProduction = process.env.NODE_ENV === "production";

export const app = new OpenAPIHono<HonoEnv>({
  strict: false,
  // Sin este hook, @hono/zod-openapi responde input inválido con su forma por
  // defecto `{ success, error }`. Lanzamos el ZodError para que el handler
  // global (lib/api/errors.ts) lo traduzca al contrato único
  // `{ error: { code: "validation_error", issues } }`.
  defaultHook: (result) => {
    if (!result.success) {
      throw result.error;
    }
  },
})
  .basePath("/api")
  .route("/v1", v1Router);

app.doc("/v1/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "Notify API",
    version: "1.0.0",
    description: "REST API de Notify. Consumida por la web y por la app móvil (Expo).",
  },
  servers: [{ url: "/api/v1", description: "Servidor por defecto" }],
});

if (!isProduction) {
  app.get(
    "/v1/docs",
    Scalar({
      url: "/api/v1/openapi.json",
      pageTitle: "Notify API — Docs",
    }),
  );
}

app.onError(onError);
app.notFound(notFoundHandler);

export type AppType = typeof app;

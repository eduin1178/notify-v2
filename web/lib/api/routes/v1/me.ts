import { createRoute, OpenAPIHono } from "@hono/zod-openapi";

import { buildServiceContext } from "@/lib/api/build-ctx";
import type { HonoEnv } from "@/lib/api/context";
import { requireSession } from "@/lib/api/middlewares/auth";
import { MeResponse } from "@/lib/services/me/schemas";
import { getMe } from "@/lib/services/me/service";

const getMeRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["me"],
  summary: "Obtener usuario autenticado y sus organizaciones",
  middleware: [requireSession] as const,
  responses: {
    200: {
      description: "Usuario autenticado.",
      content: { "application/json": { schema: MeResponse } },
    },
    401: {
      description: "Sin sesión.",
    },
  },
});

export const meRouter = new OpenAPIHono<HonoEnv>().openapi(getMeRoute, async (c) => {
  const ctx = buildServiceContext(c);
  const result = await getMe(ctx);
  return c.json(result, 200);
});

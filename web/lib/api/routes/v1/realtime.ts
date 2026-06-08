import { createRoute, OpenAPIHono } from "@hono/zod-openapi";

import {
  buildServiceContext,
  buildTenantServiceContext,
} from "@/lib/api/build-ctx";
import type { HonoEnv } from "@/lib/api/context";
import { requireSession } from "@/lib/api/middlewares/auth";
import { requireOrgMembership } from "@/lib/api/middlewares/org";
import {
  signConnectionToken,
  signSubscriptionToken,
} from "@/lib/integrations/centrifugo/tokens";
import { OrgIdParam } from "@/lib/services/orgs/schemas";
import {
  ConnectionTokenResponse,
  SubscriptionTokenInput,
  SubscriptionTokenResponse,
} from "@/lib/services/realtime/schemas";
import { authorizeInboxSubscription } from "@/lib/services/realtime/service";

const TAGS = ["realtime"];

const connectionTokenRoute = createRoute({
  method: "post",
  path: "/realtime/connection-token",
  tags: TAGS,
  summary: "Emitir un token de conexión a Centrífugo para el usuario autenticado",
  middleware: [requireSession] as const,
  responses: {
    200: {
      description: "Token de conexión (JWT con `sub` = id de usuario).",
      content: { "application/json": { schema: ConnectionTokenResponse } },
    },
    401: { description: "Sin sesión." },
  },
});

const subscriptionTokenRoute = createRoute({
  method: "post",
  path: "/orgs/{orgId}/realtime/subscription-token",
  tags: TAGS,
  summary:
    "Emitir un token de suscripción a un canal del inbox de la organización",
  middleware: [requireSession, requireOrgMembership] as const,
  request: {
    params: OrgIdParam,
    body: {
      content: { "application/json": { schema: SubscriptionTokenInput } },
    },
  },
  responses: {
    200: {
      description: "Token de suscripción (JWT con `sub`, `channel` y `exp`).",
      content: { "application/json": { schema: SubscriptionTokenResponse } },
    },
    401: { description: "Sin sesión." },
    403: { description: "Canal ajeno a la organización." },
    404: { description: "Organización no encontrada o sin membresía." },
    422: { description: "Canal no válido." },
  },
});

export const realtimeRouter = new OpenAPIHono<HonoEnv>()
  .openapi(connectionTokenRoute, async (c) => {
    const ctx = buildServiceContext(c);
    const token = await signConnectionToken(ctx.currentUser.id);
    return c.json({ token }, 200);
  })
  .openapi(subscriptionTokenRoute, async (c) => {
    const { channel } = c.req.valid("json");
    const ctx = buildTenantServiceContext(c);
    const validChannel = await authorizeInboxSubscription(ctx, channel);
    const token = await signSubscriptionToken(ctx.currentUser.id, validChannel);
    return c.json({ token }, 200);
  });

import { createRoute, OpenAPIHono } from "@hono/zod-openapi";

import { buildTenantServiceContext } from "@/lib/api/build-ctx";
import type { HonoEnv } from "@/lib/api/context";
import { requireSession } from "@/lib/api/middlewares/auth";
import { requireOrgMembership } from "@/lib/api/middlewares/org";
import { OrgIdParam } from "@/lib/services/orgs/schemas";
import {
  ConnectionIdParam,
  SetupLinkResponse,
  WhatsappConnectionDto,
  WhatsappConnectionsResponse,
} from "@/lib/services/whatsapp/schemas";
import {
  connectWhatsApp,
  disconnect,
  getConnection,
  listConnections,
  reconnect,
} from "@/lib/services/whatsapp/service";

const ConnectionItemParam = OrgIdParam.merge(ConnectionIdParam);

const TAGS = ["whatsapp"];
const COMMON_ERRORS = {
  401: { description: "Sin sesión." },
  403: { description: "Sin permisos (no miembro, o no owner/admin)." },
  404: { description: "Recurso no encontrado." },
} as const;

const connectRoute = createRoute({
  method: "post",
  path: "/orgs/{orgId}/whatsapp/connections",
  tags: TAGS,
  summary: "Generar un setup link para conectar una cuenta de WhatsApp",
  middleware: [requireSession, requireOrgMembership] as const,
  request: { params: OrgIdParam },
  responses: {
    201: {
      description: "Setup link generado; conexión en estado pending.",
      content: { "application/json": { schema: SetupLinkResponse } },
    },
    ...COMMON_ERRORS,
  },
});

const listRoute = createRoute({
  method: "get",
  path: "/orgs/{orgId}/whatsapp/connections",
  tags: TAGS,
  summary: "Listar las conexiones de WhatsApp de la organización",
  middleware: [requireSession, requireOrgMembership] as const,
  request: { params: OrgIdParam },
  responses: {
    200: {
      description: "Conexiones de la organización.",
      content: { "application/json": { schema: WhatsappConnectionsResponse } },
    },
    ...COMMON_ERRORS,
  },
});

const getRoute = createRoute({
  method: "get",
  path: "/orgs/{orgId}/whatsapp/connections/{id}",
  tags: TAGS,
  summary: "Obtener el estado de una conexión de WhatsApp",
  middleware: [requireSession, requireOrgMembership] as const,
  request: { params: ConnectionItemParam },
  responses: {
    200: {
      description: "Conexión.",
      content: { "application/json": { schema: WhatsappConnectionDto } },
    },
    ...COMMON_ERRORS,
  },
});

const disconnectRoute = createRoute({
  method: "delete",
  path: "/orgs/{orgId}/whatsapp/connections/{id}",
  tags: TAGS,
  summary: "Desconectar una cuenta de WhatsApp",
  middleware: [requireSession, requireOrgMembership] as const,
  request: { params: ConnectionItemParam },
  responses: {
    200: {
      description: "Conexión desconectada (optimista; consolida el webhook).",
      content: { "application/json": { schema: WhatsappConnectionDto } },
    },
    ...COMMON_ERRORS,
  },
});

const reconnectRoute = createRoute({
  method: "post",
  path: "/orgs/{orgId}/whatsapp/connections/{id}/reconnect",
  tags: TAGS,
  summary: "Reconectar un número de WhatsApp roto",
  middleware: [requireSession, requireOrgMembership] as const,
  request: { params: ConnectionItemParam },
  responses: {
    200: {
      description: "Setup link de reconexión generado.",
      content: { "application/json": { schema: SetupLinkResponse } },
    },
    409: { description: "La conexión no tiene un número para reconectar." },
    ...COMMON_ERRORS,
  },
});

export const whatsappConnectionsRouter = new OpenAPIHono<HonoEnv>()
  .openapi(connectRoute, async (c) => {
    const ctx = buildTenantServiceContext(c);
    const result = await connectWhatsApp(ctx);
    return c.json(result, 201);
  })
  .openapi(listRoute, async (c) => {
    const ctx = buildTenantServiceContext(c);
    const result = await listConnections(ctx);
    return c.json(result, 200);
  })
  .openapi(getRoute, async (c) => {
    const { id } = c.req.valid("param");
    const ctx = buildTenantServiceContext(c);
    const result = await getConnection(ctx, id);
    return c.json(result, 200);
  })
  .openapi(disconnectRoute, async (c) => {
    const { id } = c.req.valid("param");
    const ctx = buildTenantServiceContext(c);
    const result = await disconnect(ctx, id);
    return c.json(result, 200);
  })
  .openapi(reconnectRoute, async (c) => {
    const { id } = c.req.valid("param");
    const ctx = buildTenantServiceContext(c);
    const result = await reconnect(ctx, id);
    return c.json(result, 200);
  });

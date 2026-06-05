import { createRoute, OpenAPIHono } from "@hono/zod-openapi";

import { buildTenantServiceContext } from "@/lib/api/build-ctx";
import type { HonoEnv } from "@/lib/api/context";
import { requireSession } from "@/lib/api/middlewares/auth";
import { requireOrgMembership } from "@/lib/api/middlewares/org";
import { OrgIdParam } from "@/lib/services/orgs/schemas";
import {
  ConnectionIdParam,
  ImportablePhoneNumbersResponse,
  ImportPhoneNumberInput,
  RenameConnectionInput,
  SetupLinkResponse,
  WhatsappConnectionDto,
  WhatsappConnectionsResponse,
} from "@/lib/services/whatsapp/schemas";
import {
  connectWhatsApp,
  disconnect,
  getConnection,
  importPhoneNumber,
  listConnections,
  listImportablePhoneNumbers,
  reconnect,
  renameConnection,
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

const listImportableRoute = createRoute({
  method: "get",
  path: "/orgs/{orgId}/whatsapp/connections/importable",
  tags: TAGS,
  summary: "Listar números existentes en Kapso aún no agregados a Notify",
  middleware: [requireSession, requireOrgMembership] as const,
  request: { params: OrgIdParam },
  responses: {
    200: {
      description: "Números importables (del customer de la organización).",
      content: {
        "application/json": { schema: ImportablePhoneNumbersResponse },
      },
    },
    ...COMMON_ERRORS,
  },
});

const importRoute = createRoute({
  method: "post",
  path: "/orgs/{orgId}/whatsapp/connections/import",
  tags: TAGS,
  summary: "Importar un número existente de Kapso a Notify (reconciliación)",
  middleware: [requireSession, requireOrgMembership] as const,
  request: {
    params: OrgIdParam,
    body: {
      content: { "application/json": { schema: ImportPhoneNumberInput } },
    },
  },
  responses: {
    201: {
      description: "Número importado; conexión en estado connected.",
      content: { "application/json": { schema: WhatsappConnectionDto } },
    },
    409: { description: "La organización aún no tiene cuenta de Kapso." },
    ...COMMON_ERRORS,
  },
});

const renameRoute = createRoute({
  method: "patch",
  path: "/orgs/{orgId}/whatsapp/connections/{id}",
  tags: TAGS,
  summary: "Renombrar una conexión de WhatsApp",
  middleware: [requireSession, requireOrgMembership] as const,
  request: {
    params: ConnectionItemParam,
    body: {
      content: { "application/json": { schema: RenameConnectionInput } },
    },
  },
  responses: {
    200: {
      description: "Conexión renombrada.",
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
  // Antes de getRoute: "importable" no debe capturarse como :id.
  .openapi(listImportableRoute, async (c) => {
    const ctx = buildTenantServiceContext(c);
    const result = await listImportablePhoneNumbers(ctx);
    return c.json(result, 200);
  })
  .openapi(importRoute, async (c) => {
    const { phoneNumberId } = c.req.valid("json");
    const ctx = buildTenantServiceContext(c);
    const result = await importPhoneNumber(ctx, phoneNumberId);
    return c.json(result, 201);
  })
  .openapi(getRoute, async (c) => {
    const { id } = c.req.valid("param");
    const ctx = buildTenantServiceContext(c);
    const result = await getConnection(ctx, id);
    return c.json(result, 200);
  })
  .openapi(renameRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { name } = c.req.valid("json");
    const ctx = buildTenantServiceContext(c);
    const result = await renameConnection(ctx, id, name);
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

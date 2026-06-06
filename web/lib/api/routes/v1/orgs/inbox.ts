import { createRoute, OpenAPIHono } from "@hono/zod-openapi";

import { buildTenantServiceContext } from "@/lib/api/build-ctx";
import type { HonoEnv } from "@/lib/api/context";
import { requireSession } from "@/lib/api/middlewares/auth";
import { requireOrgMembership } from "@/lib/api/middlewares/org";
import {
  AssignInput,
  ConnectionIdParam,
  ConversationDto,
  ConversationIdParam,
  ConversationListResponse,
  InboxNumbersResponse,
  InboxSettingsDto,
  ListConversationsQuery,
  MessageThreadQuery,
  MessageThreadResponse,
  UpdateInboxSettingsInput,
  UpdateStatusInput,
} from "@/lib/services/inbox/schemas";
import {
  assignConversation,
  getInboxSettings,
  getMessages,
  listConversations,
  listNumbers,
  markRead,
  setConversationStatus,
  updateInboxSettings,
} from "@/lib/services/inbox/service";
import { OrgIdParam } from "@/lib/services/orgs/schemas";

const ConversationItemParam = OrgIdParam.merge(ConversationIdParam);
const NumberSettingsParam = OrgIdParam.merge(ConnectionIdParam);

const TAGS = ["inbox"];
const COMMON_ERRORS = {
  401: { description: "Sin sesión." },
  403: { description: "No miembro de la organización." },
  404: { description: "Recurso no encontrado." },
} as const;

const numbersRoute = createRoute({
  method: "get",
  path: "/orgs/{orgId}/inbox/numbers",
  tags: TAGS,
  summary: "Listar los números conectados para el selector del inbox",
  middleware: [requireSession, requireOrgMembership] as const,
  request: { params: OrgIdParam },
  responses: {
    200: {
      description: "Números conectados de la organización.",
      content: { "application/json": { schema: InboxNumbersResponse } },
    },
    ...COMMON_ERRORS,
  },
});

const conversationsRoute = createRoute({
  method: "get",
  path: "/orgs/{orgId}/inbox/conversations",
  tags: TAGS,
  summary: "Listar conversaciones de un número (índice local, filtrable)",
  middleware: [requireSession, requireOrgMembership] as const,
  request: { params: OrgIdParam, query: ListConversationsQuery },
  responses: {
    200: {
      description: "Página de conversaciones.",
      content: { "application/json": { schema: ConversationListResponse } },
    },
    ...COMMON_ERRORS,
  },
});

const messagesRoute = createRoute({
  method: "get",
  path: "/orgs/{orgId}/inbox/conversations/{id}/messages",
  tags: TAGS,
  summary: "Hilo de mensajes de una conversación (read-through desde Kapso)",
  middleware: [requireSession, requireOrgMembership] as const,
  request: { params: ConversationItemParam, query: MessageThreadQuery },
  responses: {
    200: {
      description: "Mensajes de la conversación (newest-first).",
      content: { "application/json": { schema: MessageThreadResponse } },
    },
    ...COMMON_ERRORS,
  },
});

const updateStatusRoute = createRoute({
  method: "patch",
  path: "/orgs/{orgId}/inbox/conversations/{id}",
  tags: TAGS,
  summary: "Cambiar el estado de una conversación",
  middleware: [requireSession, requireOrgMembership] as const,
  request: {
    params: ConversationItemParam,
    body: { content: { "application/json": { schema: UpdateStatusInput } } },
  },
  responses: {
    200: {
      description: "Conversación actualizada.",
      content: { "application/json": { schema: ConversationDto } },
    },
    ...COMMON_ERRORS,
  },
});

const assignRoute = createRoute({
  method: "put",
  path: "/orgs/{orgId}/inbox/conversations/{id}/assignment",
  tags: TAGS,
  summary: "Asignar o desasignar una conversación a un agente",
  middleware: [requireSession, requireOrgMembership] as const,
  request: {
    params: ConversationItemParam,
    body: { content: { "application/json": { schema: AssignInput } } },
  },
  responses: {
    200: {
      description: "Conversación actualizada.",
      content: { "application/json": { schema: ConversationDto } },
    },
    ...COMMON_ERRORS,
  },
});

const readRoute = createRoute({
  method: "post",
  path: "/orgs/{orgId}/inbox/conversations/{id}/read",
  tags: TAGS,
  summary: "Marcar la conversación como leída (resetea no leídos)",
  middleware: [requireSession, requireOrgMembership] as const,
  request: { params: ConversationItemParam },
  responses: {
    200: {
      description: "Conversación marcada como leída.",
      content: { "application/json": { schema: ConversationDto } },
    },
    ...COMMON_ERRORS,
  },
});

const getSettingsRoute = createRoute({
  method: "get",
  path: "/orgs/{orgId}/inbox/numbers/{connectionId}/settings",
  tags: TAGS,
  summary: "Obtener la configuración del inbox de un número",
  middleware: [requireSession, requireOrgMembership] as const,
  request: { params: NumberSettingsParam },
  responses: {
    200: {
      description: "Configuración del número.",
      content: { "application/json": { schema: InboxSettingsDto } },
    },
    ...COMMON_ERRORS,
  },
});

const updateSettingsRoute = createRoute({
  method: "put",
  path: "/orgs/{orgId}/inbox/numbers/{connectionId}/settings",
  tags: TAGS,
  summary: "Actualizar la configuración del inbox de un número (owner/admin)",
  middleware: [requireSession, requireOrgMembership] as const,
  request: {
    params: NumberSettingsParam,
    body: {
      content: { "application/json": { schema: UpdateInboxSettingsInput } },
    },
  },
  responses: {
    200: {
      description: "Configuración actualizada.",
      content: { "application/json": { schema: InboxSettingsDto } },
    },
    ...COMMON_ERRORS,
  },
});

export const inboxRouter = new OpenAPIHono<HonoEnv>()
  .openapi(numbersRoute, async (c) => {
    const ctx = buildTenantServiceContext(c);
    const numbers = await listNumbers(ctx);
    return c.json({ numbers }, 200);
  })
  .openapi(conversationsRoute, async (c) => {
    const query = c.req.valid("query");
    const ctx = buildTenantServiceContext(c);
    const result = await listConversations(ctx, query);
    return c.json(result, 200);
  })
  .openapi(messagesRoute, async (c) => {
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");
    const ctx = buildTenantServiceContext(c);
    const result = await getMessages(ctx, id, query);
    return c.json(result, 200);
  })
  .openapi(updateStatusRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { status } = c.req.valid("json");
    const ctx = buildTenantServiceContext(c);
    const result = await setConversationStatus(ctx, id, status);
    return c.json(result, 200);
  })
  .openapi(assignRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { userId } = c.req.valid("json");
    const ctx = buildTenantServiceContext(c);
    const result = await assignConversation(ctx, id, userId);
    return c.json(result, 200);
  })
  .openapi(readRoute, async (c) => {
    const { id } = c.req.valid("param");
    const ctx = buildTenantServiceContext(c);
    const result = await markRead(ctx, id);
    return c.json(result, 200);
  })
  .openapi(getSettingsRoute, async (c) => {
    const { connectionId } = c.req.valid("param");
    const ctx = buildTenantServiceContext(c);
    const result = await getInboxSettings(ctx, connectionId);
    return c.json(result, 200);
  })
  .openapi(updateSettingsRoute, async (c) => {
    const { connectionId } = c.req.valid("param");
    const input = c.req.valid("json");
    const ctx = buildTenantServiceContext(c);
    const result = await updateInboxSettings(ctx, connectionId, input);
    return c.json(result, 200);
  });

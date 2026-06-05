import { createRoute, OpenAPIHono } from "@hono/zod-openapi";

import { buildTenantServiceContext } from "@/lib/api/build-ctx";
import type { HonoEnv } from "@/lib/api/context";
import { requireSession } from "@/lib/api/middlewares/auth";
import { requireOrgMembership } from "@/lib/api/middlewares/org";
import {
  ContactDto,
  ContactIdParam,
  CreateContactInput,
  ListContactsQuery,
  PaginatedContactsResponse,
  UpdateContactInput,
} from "@/lib/services/contacts/schemas";
import {
  createContact,
  deleteContact,
  getContact,
  listContacts,
  updateContact,
} from "@/lib/services/contacts/service";
import { OrgIdParam } from "@/lib/services/orgs/schemas";

const ContactItemParam = OrgIdParam.merge(ContactIdParam);

const TAGS = ["contacts"];
const COMMON_ERRORS = {
  401: { description: "Sin sesión." },
  403: { description: "No miembro de la organización." },
  404: { description: "Recurso no encontrado." },
} as const;

const listRoute = createRoute({
  method: "get",
  path: "/orgs/{orgId}/contacts",
  tags: TAGS,
  summary: "Listar contactos de la organización (paginado por offset)",
  middleware: [requireSession, requireOrgMembership] as const,
  request: { params: OrgIdParam, query: ListContactsQuery },
  responses: {
    200: {
      description: "Página de contactos con metadatos de paginación.",
      content: { "application/json": { schema: PaginatedContactsResponse } },
    },
    ...COMMON_ERRORS,
  },
});

const createRouteDef = createRoute({
  method: "post",
  path: "/orgs/{orgId}/contacts",
  tags: TAGS,
  summary: "Crear un contacto",
  middleware: [requireSession, requireOrgMembership] as const,
  request: {
    params: OrgIdParam,
    body: { content: { "application/json": { schema: CreateContactInput } } },
  },
  responses: {
    201: {
      description: "Contacto creado.",
      content: { "application/json": { schema: ContactDto } },
    },
    409: { description: "Ya existe un contacto con ese teléfono." },
    422: { description: "Teléfono inválido." },
    ...COMMON_ERRORS,
  },
});

const getRoute = createRoute({
  method: "get",
  path: "/orgs/{orgId}/contacts/{id}",
  tags: TAGS,
  summary: "Obtener un contacto",
  middleware: [requireSession, requireOrgMembership] as const,
  request: { params: ContactItemParam },
  responses: {
    200: {
      description: "Contacto.",
      content: { "application/json": { schema: ContactDto } },
    },
    ...COMMON_ERRORS,
  },
});

const updateRoute = createRoute({
  method: "patch",
  path: "/orgs/{orgId}/contacts/{id}",
  tags: TAGS,
  summary: "Actualizar un contacto",
  middleware: [requireSession, requireOrgMembership] as const,
  request: {
    params: ContactItemParam,
    body: { content: { "application/json": { schema: UpdateContactInput } } },
  },
  responses: {
    200: {
      description: "Contacto actualizado.",
      content: { "application/json": { schema: ContactDto } },
    },
    409: { description: "Ya existe un contacto con ese teléfono." },
    422: { description: "Teléfono inválido." },
    ...COMMON_ERRORS,
  },
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/orgs/{orgId}/contacts/{id}",
  tags: TAGS,
  summary: "Eliminar un contacto",
  middleware: [requireSession, requireOrgMembership] as const,
  request: { params: ContactItemParam },
  responses: {
    204: { description: "Contacto eliminado." },
    ...COMMON_ERRORS,
  },
});

export const contactsRouter = new OpenAPIHono<HonoEnv>()
  .openapi(listRoute, async (c) => {
    const query = c.req.valid("query");
    const ctx = buildTenantServiceContext(c);
    const result = await listContacts(ctx, query);
    return c.json(result, 200);
  })
  .openapi(createRouteDef, async (c) => {
    const input = c.req.valid("json");
    const ctx = buildTenantServiceContext(c);
    const result = await createContact(ctx, input);
    return c.json(result, 201);
  })
  .openapi(getRoute, async (c) => {
    const { id } = c.req.valid("param");
    const ctx = buildTenantServiceContext(c);
    const result = await getContact(ctx, id);
    return c.json(result, 200);
  })
  .openapi(updateRoute, async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const ctx = buildTenantServiceContext(c);
    const result = await updateContact(ctx, id, input);
    return c.json(result, 200);
  })
  .openapi(deleteRoute, async (c) => {
    const { id } = c.req.valid("param");
    const ctx = buildTenantServiceContext(c);
    await deleteContact(ctx, id);
    return c.body(null, 204);
  });

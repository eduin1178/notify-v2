import { createRoute, OpenAPIHono } from "@hono/zod-openapi";

import { buildTenantServiceContext } from "@/lib/api/build-ctx";
import type { HonoEnv } from "@/lib/api/context";
import { requireSession } from "@/lib/api/middlewares/auth";
import { requireOrgMembership } from "@/lib/api/middlewares/org";
import {
  CreateTagInput,
  TagDto,
  TagIdParam,
  TagsResponse,
} from "@/lib/services/contacts/schemas";
import { createTag, deleteTag, listTags } from "@/lib/services/contacts/service";
import { OrgIdParam } from "@/lib/services/orgs/schemas";

const TagItemParam = OrgIdParam.merge(TagIdParam);

const TAGS = ["tags"];
const COMMON_ERRORS = {
  401: { description: "Sin sesión." },
  403: { description: "No miembro de la organización." },
  404: { description: "Recurso no encontrado." },
} as const;

const listRoute = createRoute({
  method: "get",
  path: "/orgs/{orgId}/tags",
  tags: TAGS,
  summary: "Listar etiquetas de la organización",
  middleware: [requireSession, requireOrgMembership] as const,
  request: { params: OrgIdParam },
  responses: {
    200: {
      description: "Etiquetas de la organización.",
      content: { "application/json": { schema: TagsResponse } },
    },
    ...COMMON_ERRORS,
  },
});

const createRouteDef = createRoute({
  method: "post",
  path: "/orgs/{orgId}/tags",
  tags: TAGS,
  summary: "Crear una etiqueta",
  middleware: [requireSession, requireOrgMembership] as const,
  request: {
    params: OrgIdParam,
    body: { content: { "application/json": { schema: CreateTagInput } } },
  },
  responses: {
    201: {
      description: "Etiqueta creada.",
      content: { "application/json": { schema: TagDto } },
    },
    409: { description: "Ya existe una etiqueta con ese nombre." },
    ...COMMON_ERRORS,
  },
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/orgs/{orgId}/tags/{tagId}",
  tags: TAGS,
  summary: "Eliminar una etiqueta",
  middleware: [requireSession, requireOrgMembership] as const,
  request: { params: TagItemParam },
  responses: {
    204: { description: "Etiqueta eliminada." },
    ...COMMON_ERRORS,
  },
});

export const tagsRouter = new OpenAPIHono<HonoEnv>()
  .openapi(listRoute, async (c) => {
    const ctx = buildTenantServiceContext(c);
    const tags = await listTags(ctx);
    return c.json({ tags }, 200);
  })
  .openapi(createRouteDef, async (c) => {
    const { name } = c.req.valid("json");
    const ctx = buildTenantServiceContext(c);
    const tag = await createTag(ctx, name);
    return c.json(tag, 201);
  })
  .openapi(deleteRoute, async (c) => {
    const { tagId } = c.req.valid("param");
    const ctx = buildTenantServiceContext(c);
    await deleteTag(ctx, tagId);
    return c.body(null, 204);
  });

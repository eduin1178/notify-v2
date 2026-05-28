import { createRoute, OpenAPIHono } from "@hono/zod-openapi";

import { buildServiceContext } from "@/lib/api/build-ctx";
import type { HonoEnv } from "@/lib/api/context";
import { requireSession } from "@/lib/api/middlewares/auth";
import { requireOrgMembership } from "@/lib/api/middlewares/org";
import { MembersResponse, OrgIdParam } from "@/lib/services/orgs/schemas";
import { listMembers } from "@/lib/services/orgs/service";

const listMembersRoute = createRoute({
  method: "get",
  path: "/orgs/{orgId}/members",
  tags: ["orgs"],
  summary: "Listar miembros de una organización",
  middleware: [requireSession, requireOrgMembership] as const,
  request: {
    params: OrgIdParam,
  },
  responses: {
    200: {
      description: "Miembros de la organización.",
      content: { "application/json": { schema: MembersResponse } },
    },
    401: { description: "Sin sesión." },
    403: { description: "No miembro de la organización." },
    404: { description: "Organización no encontrada." },
  },
});

export const listMembersRouter = new OpenAPIHono<HonoEnv>().openapi(
  listMembersRoute,
  async (c) => {
    const { orgId } = c.req.valid("param");
    const ctx = buildServiceContext(c);
    const result = await listMembers(ctx, orgId);
    return c.json(result, 200);
  },
);

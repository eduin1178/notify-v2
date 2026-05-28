import { createRoute, OpenAPIHono } from "@hono/zod-openapi";

import { buildServiceContext } from "@/lib/api/build-ctx";
import type { HonoEnv } from "@/lib/api/context";
import { requireSession } from "@/lib/api/middlewares/auth";
import { requireOrgMembership } from "@/lib/api/middlewares/org";
import { OrganizationDto, OrgIdParam } from "@/lib/services/orgs/schemas";
import { getOrg } from "@/lib/services/orgs/service";

const getOrgRoute = createRoute({
  method: "get",
  path: "/orgs/{orgId}",
  tags: ["orgs"],
  summary: "Obtener una organización por id",
  middleware: [requireSession, requireOrgMembership] as const,
  request: {
    params: OrgIdParam,
  },
  responses: {
    200: {
      description: "Organización.",
      content: { "application/json": { schema: OrganizationDto } },
    },
    401: { description: "Sin sesión." },
    403: { description: "No miembro de la organización." },
    404: { description: "Organización no encontrada." },
  },
});

export const getOrgRouter = new OpenAPIHono<HonoEnv>().openapi(
  getOrgRoute,
  async (c) => {
    const { orgId } = c.req.valid("param");
    const ctx = buildServiceContext(c);
    const result = await getOrg(ctx, orgId);
    return c.json(result, 200);
  },
);

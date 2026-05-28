import { and, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";

import type { HonoEnv } from "@/lib/api/context";
import { db } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";
import { DomainErrors } from "@/lib/services/errors";

/**
 * Resuelve `:orgId` del path, verifica que el usuario autenticado es miembro
 * y deja la organización en `c.var.org`.
 *
 * Debe usarse SIEMPRE después de `requireSession`.
 */
export const requireOrgMembership = createMiddleware<HonoEnv>(async (c, next) => {
  const user = c.get("user");
  const orgId = c.req.param("orgId");

  if (!user) {
    throw DomainErrors.unauthorized("Sesión requerida.");
  }

  if (!orgId) {
    throw DomainErrors.notFound("Organización no encontrada.");
  }

  const orgRow = await db
    .select({
      id: schema.organization.id,
      name: schema.organization.name,
      slug: schema.organization.slug,
    })
    .from(schema.organization)
    .where(eq(schema.organization.id, orgId))
    .limit(1);

  const org = orgRow[0];
  if (!org) {
    throw DomainErrors.notFound("Organización no encontrada.");
  }

  const memberRow = await db
    .select({ id: schema.member.id })
    .from(schema.member)
    .where(
      and(
        eq(schema.member.userId, user.id),
        eq(schema.member.organizationId, org.id),
      ),
    )
    .limit(1);

  if (!memberRow[0]) {
    throw DomainErrors.forbidden("No eres miembro de esta organización.");
  }

  c.set("org", { id: org.id, name: org.name, slug: org.slug });
  await next();
});

/**
 * Puente Next → capa de servicios.
 *
 * Construye `ServiceContext` desde Server Components y Server Actions reusando
 * la sesión de `better-auth`. Vive en `lib/api/` (la capa de adaptadores), NO
 * en `lib/services/`, porque importa `next/headers`.
 *
 * Reflejo del bridge equivalente para Hono: `web/lib/api/build-ctx.ts`.
 */

import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";
import { resolveRealtimePublisher } from "@/lib/integrations/centrifugo/publisher";
import {
  makeEntitlementsPort,
  makeUsagePort,
} from "@/lib/services/billing/adapter";
import type { ServiceContext, TenantServiceContext } from "@/lib/services/context";
import { DomainErrors } from "@/lib/services/errors";
import { consoleLogger } from "@/lib/services/logger";

export async function buildServerServiceContext(): Promise<ServiceContext> {
  const headerList = await headers();
  const session = await auth.api.getSession({ headers: headerList });

  if (!session) {
    throw DomainErrors.unauthorized("Sesión requerida.");
  }

  return {
    db,
    currentUser: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image ?? null,
      role: (session.user as { role?: string | null }).role ?? null,
    },
    logger: consoleLogger,
    realtime: resolveRealtimePublisher(consoleLogger),
  };
}

/**
 * Puente Next → contexto tenant-scoped. Carga la organización por id y adjunta
 * la costura de billing (`entitlements`/`usage`). Espejo de `buildTenantServiceContext`
 * de Hono. El `organizationId` debe resolverlo el llamante (p. ej. vía
 * `requireActiveOrganization()` en `lib/auth/guards.ts`).
 */
export async function buildServerTenantServiceContext(
  organizationId: string,
): Promise<TenantServiceContext> {
  const ctx = await buildServerServiceContext();

  const orgRow = await db
    .select({
      id: schema.organization.id,
      name: schema.organization.name,
      slug: schema.organization.slug,
    })
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);

  const org = orgRow[0];
  if (!org) {
    throw DomainErrors.notFound("Organización no encontrada.");
  }

  return {
    ...ctx,
    currentOrg: org,
    entitlements: makeEntitlementsPort(db, org.id),
    usage: makeUsagePort(db, org.id),
  };
}

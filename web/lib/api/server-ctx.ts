/**
 * Puente Next → capa de servicios.
 *
 * Construye `ServiceContext` desde Server Components y Server Actions reusando
 * la sesión de `better-auth`. Vive en `lib/api/` (la capa de adaptadores), NO
 * en `lib/services/`, porque importa `next/headers`.
 *
 * Reflejo del bridge equivalente para Hono: `web/lib/api/build-ctx.ts`.
 */

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import type { ServiceContext } from "@/lib/services/context";
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
  };
}

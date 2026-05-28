import type { Context } from "hono";

import type { HonoEnv } from "@/lib/api/context";
import { db } from "@/lib/db/client";
import type { ServiceContext, TenantServiceContext } from "@/lib/services/context";
import { DomainErrors } from "@/lib/services/errors";
import { consoleLogger } from "@/lib/services/logger";

export function buildServiceContext(c: Context<HonoEnv>): ServiceContext {
  const user = c.get("user");
  if (!user) {
    throw DomainErrors.unauthorized("Sesión requerida.");
  }
  return {
    db,
    currentUser: user,
    currentOrg: c.get("org"),
    logger: consoleLogger,
  };
}

export function buildTenantServiceContext(
  c: Context<HonoEnv>,
): TenantServiceContext {
  const ctx = buildServiceContext(c);
  if (!ctx.currentOrg) {
    throw DomainErrors.forbidden("Organización requerida.");
  }
  return ctx as TenantServiceContext;
}

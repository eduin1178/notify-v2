import type { Context } from "hono";

import type { HonoEnv } from "@/lib/api/context";
import { db } from "@/lib/db/client";
import {
  makeEntitlementsPort,
  makeUsagePort,
} from "@/lib/services/billing/adapter";
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
  const organizationId = ctx.currentOrg.id;
  return {
    ...ctx,
    currentOrg: ctx.currentOrg,
    entitlements: makeEntitlementsPort(db, organizationId),
    usage: makeUsagePort(db, organizationId),
  };
}

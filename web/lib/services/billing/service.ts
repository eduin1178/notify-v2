/**
 * Servicios de gestión de billing para SuperAdmin: consultar el billing de una
 * organización, cambiar su plan y administrar overrides de límite. NO incluye
 * cobro (engine diferido).
 *
 * Módulo puro: NO importa `next/*`, `hono`, `@hono/*` ni `web/app/**`.
 */

import { and, eq } from "drizzle-orm";

import { schema } from "@/lib/db/schema";
import { makeEntitlementsPort } from "@/lib/services/billing/adapter";
import { isPlanKey, type PlanKey } from "@/lib/services/billing/catalog";
import {
  ENTITLEMENT_KEYS,
  type EntitlementKey,
  kindOf,
} from "@/lib/services/billing/entitlements";
import type {
  OrgBillingDtoT,
  PlanDtoT,
  SetOverrideInputT,
} from "@/lib/services/billing/schemas";
import type { ServiceContext } from "@/lib/services/context";
import { DomainErrors } from "@/lib/services/errors";

/** Verificación de dominio: el llamante debe ser SuperAdmin (role "admin"). */
function ensureSuperAdmin(ctx: ServiceContext): void {
  if (ctx.currentUser.role !== "admin") {
    throw DomainErrors.forbidden("Se requiere rol SuperAdmin.");
  }
}

async function loadOrgName(ctx: ServiceContext, organizationId: string): Promise<string> {
  const org = await ctx.db
    .select({ name: schema.organization.name })
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);
  if (!org[0]) {
    throw DomainErrors.notFound("Organización no encontrada.");
  }
  return org[0].name;
}

async function ensureOrgExists(ctx: ServiceContext, organizationId: string): Promise<void> {
  await loadOrgName(ctx, organizationId);
}

async function resolvePlanIdByKey(ctx: ServiceContext, planKey: PlanKey): Promise<string> {
  const rows = await ctx.db
    .select({ id: schema.plan.id })
    .from(schema.plan)
    .where(eq(schema.plan.key, planKey))
    .limit(1);
  if (!rows[0]) {
    throw DomainErrors.notFound(`Plan '${planKey}' no encontrado en el catálogo.`);
  }
  return rows[0].id;
}

/** Lista el catálogo de planes (para el selector del panel). */
export async function listPlans(ctx: ServiceContext): Promise<PlanDtoT[]> {
  ensureSuperAdmin(ctx);
  const rows = await ctx.db
    .select({
      key: schema.plan.key,
      name: schema.plan.name,
      priceUsd: schema.plan.priceUsd,
    })
    .from(schema.plan)
    .orderBy(schema.plan.sortOrder);

  return rows
    .filter((r): r is { key: PlanKey; name: string; priceUsd: string } => isPlanKey(r.key))
    .map((r) => ({ key: r.key, name: r.name, priceUsd: r.priceUsd }));
}

/** Billing de una organización: plan vigente + límites efectivos por entitlement. */
export async function getOrgBilling(
  ctx: ServiceContext,
  organizationId: string,
): Promise<OrgBillingDtoT> {
  ensureSuperAdmin(ctx);
  const organizationName = await loadOrgName(ctx, organizationId);

  const sub = await ctx.db
    .select({
      status: schema.subscription.status,
      planKey: schema.plan.key,
      planName: schema.plan.name,
      priceUsd: schema.plan.priceUsd,
    })
    .from(schema.subscription)
    .innerJoin(schema.plan, eq(schema.subscription.planId, schema.plan.id))
    .where(eq(schema.subscription.organizationId, organizationId))
    .limit(1);

  const overrides = await ctx.db
    .select({ key: schema.organizationEntitlementOverride.key })
    .from(schema.organizationEntitlementOverride)
    .where(eq(schema.organizationEntitlementOverride.organizationId, organizationId));
  const overriddenKeys = new Set(overrides.map((o) => o.key));

  const port = makeEntitlementsPort(ctx.db, organizationId);
  const entitlements = await Promise.all(
    ENTITLEMENT_KEYS.map(async (key) => {
      const value = await port.effectiveLimit(key);
      return {
        key,
        kind: kindOf(key),
        int: value.int,
        bool: value.bool,
        overridden: overriddenKeys.has(key),
      };
    }),
  );

  const planRow = sub[0];
  return {
    organizationId,
    organizationName,
    plan:
      planRow && isPlanKey(planRow.planKey)
        ? { key: planRow.planKey, name: planRow.planName, priceUsd: planRow.priceUsd }
        : null,
    status: planRow?.status ?? null,
    entitlements,
  };
}

/** Cambia el plan de una organización (crea la suscripción si no existe). */
export async function setPlan(
  ctx: ServiceContext,
  organizationId: string,
  planKey: PlanKey,
): Promise<void> {
  ensureSuperAdmin(ctx);
  await ensureOrgExists(ctx, organizationId);
  const planId = await resolvePlanIdByKey(ctx, planKey);

  const existing = await ctx.db
    .select({ id: schema.subscription.id })
    .from(schema.subscription)
    .where(eq(schema.subscription.organizationId, organizationId))
    .limit(1);

  if (existing[0]) {
    await ctx.db
      .update(schema.subscription)
      .set({ planId, updatedAt: new Date() })
      .where(eq(schema.subscription.id, existing[0].id));
  } else {
    await ctx.db.insert(schema.subscription).values({
      id: crypto.randomUUID(),
      organizationId,
      planId,
      status: "active",
    });
  }
  ctx.logger.info("billing.setPlan", { organizationId, planKey });
}

/** Define o actualiza un override de límite para una organización. */
export async function setOverride(
  ctx: ServiceContext,
  organizationId: string,
  input: SetOverrideInputT,
): Promise<void> {
  ensureSuperAdmin(ctx);
  await ensureOrgExists(ctx, organizationId);

  const key = input.key as EntitlementKey;
  const intValue = input.int ?? null;
  const boolValue = input.bool ?? null;

  const existing = await ctx.db
    .select({ id: schema.organizationEntitlementOverride.id })
    .from(schema.organizationEntitlementOverride)
    .where(
      and(
        eq(schema.organizationEntitlementOverride.organizationId, organizationId),
        eq(schema.organizationEntitlementOverride.key, key),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await ctx.db
      .update(schema.organizationEntitlementOverride)
      .set({ intValue, boolValue, updatedAt: new Date() })
      .where(eq(schema.organizationEntitlementOverride.id, existing[0].id));
  } else {
    await ctx.db.insert(schema.organizationEntitlementOverride).values({
      id: crypto.randomUUID(),
      organizationId,
      key,
      intValue,
      boolValue,
    });
  }
}

/** Limpia el override de un entitlement: el límite vuelve a resolverse del plan. */
export async function clearOverride(
  ctx: ServiceContext,
  organizationId: string,
  key: EntitlementKey,
): Promise<void> {
  ensureSuperAdmin(ctx);
  await ensureOrgExists(ctx, organizationId);

  await ctx.db
    .delete(schema.organizationEntitlementOverride)
    .where(
      and(
        eq(schema.organizationEntitlementOverride.organizationId, organizationId),
        eq(schema.organizationEntitlementOverride.key, key),
      ),
    );
}

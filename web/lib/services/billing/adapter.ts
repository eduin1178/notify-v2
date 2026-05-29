/**
 * Adapter DB de la costura de billing: construye `EntitlementsPort` y `UsagePort`
 * ligados a una organización, resolviendo límites efectivos y aplicando el
 * enforcement de topes duros. Ver design D1/D4/D5/D8.
 *
 * Módulo puro: NO importa `next/*`, `hono`, `@hono/*` ni `web/app/**`.
 */

import { and, eq } from "drizzle-orm";

import type { db as DbClient } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";
import { DEFAULT_PLAN_KEY } from "@/lib/services/billing/catalog";
import {
  type EntitlementKey,
  kindOf,
} from "@/lib/services/billing/entitlements";
import type {
  AuthorizeInput,
  EntitlementDecision,
  EntitlementValue,
  EntitlementsPort,
  UsagePort,
} from "@/lib/services/billing/ports";

type Db = typeof DbClient;

async function resolveActivePlanId(db: Db, organizationId: string): Promise<string> {
  const sub = await db
    .select({ planId: schema.subscription.planId })
    .from(schema.subscription)
    .where(eq(schema.subscription.organizationId, organizationId))
    .limit(1);

  if (sub[0]) return sub[0].planId;

  // Defensa: sin suscripción, resolver el plan por defecto (Trial). El backfill
  // garantiza que toda org tenga suscripción, pero no asumimos su presencia.
  const fallback = await db
    .select({ id: schema.plan.id })
    .from(schema.plan)
    .where(eq(schema.plan.key, DEFAULT_PLAN_KEY))
    .limit(1);

  if (!fallback[0]) {
    throw new Error(
      `Billing mal sembrado: no existe ni suscripción para ${organizationId} ni plan '${DEFAULT_PLAN_KEY}'.`,
    );
  }
  return fallback[0].id;
}

async function resolveEffectiveLimit(
  db: Db,
  organizationId: string,
  key: EntitlementKey,
): Promise<EntitlementValue> {
  // 1) Override por org prevalece sobre el plan.
  const override = await db
    .select({
      intValue: schema.organizationEntitlementOverride.intValue,
      boolValue: schema.organizationEntitlementOverride.boolValue,
    })
    .from(schema.organizationEntitlementOverride)
    .where(
      and(
        eq(schema.organizationEntitlementOverride.organizationId, organizationId),
        eq(schema.organizationEntitlementOverride.key, key),
      ),
    )
    .limit(1);

  if (override[0]) {
    return { int: override[0].intValue, bool: override[0].boolValue };
  }

  // 2) Valor del plan vigente.
  const planId = await resolveActivePlanId(db, organizationId);
  const planEnt = await db
    .select({
      intValue: schema.planEntitlement.intValue,
      boolValue: schema.planEntitlement.boolValue,
    })
    .from(schema.planEntitlement)
    .where(
      and(
        eq(schema.planEntitlement.planId, planId),
        eq(schema.planEntitlement.key, key),
      ),
    )
    .limit(1);

  if (planEnt[0]) {
    return { int: planEnt[0].intValue, bool: planEnt[0].boolValue };
  }

  return { int: null, bool: null };
}

function authorizeAgainst(
  key: EntitlementKey,
  value: EntitlementValue,
  input: AuthorizeInput,
): EntitlementDecision {
  const kind = kindOf(key);

  switch (kind) {
    case "unlimited":
    case "metadata":
      return { allowed: true };

    case "metered_quota":
      // v0: el cupo medido (mensajes) NO bloquea; el overage se difiere al engine.
      return { allowed: true };

    case "boolean":
      if (value.bool === true) return { allowed: true };
      return {
        allowed: false,
        reason: `La capacidad "${key}" no está incluida en el plan actual.`,
        key,
        limit: null,
        current: null,
        upgradeHint: "Cambia a un plan que incluya esta capacidad.",
      };

    case "counted_cap": {
      const limit = value.int;
      if (limit === null) return { allowed: true }; // sin límite configurado
      const current = input.current ?? 0;
      const delta = input.delta ?? 1;
      if (current + delta <= limit) return { allowed: true };
      return {
        allowed: false,
        reason: `Alcanzaste el límite de "${key}" (${limit}) de tu plan.`,
        key,
        limit,
        current,
        upgradeHint: "Sube de plan o ajusta el límite con un administrador.",
      };
    }

    default: {
      // Exhaustividad: si se agrega un kind nuevo, TypeScript lo señala aquí.
      const _exhaustive: never = kind;
      throw new Error(`Entitlement kind no manejado: ${String(_exhaustive)}`);
    }
  }
}

/** Construye el `EntitlementsPort` ligado a una organización. */
export function makeEntitlementsPort(db: Db, organizationId: string): EntitlementsPort {
  return {
    async effectiveLimit(key) {
      return resolveEffectiveLimit(db, organizationId, key);
    },
    async authorize(input) {
      const value = await resolveEffectiveLimit(db, organizationId, input.key);
      return authorizeAgainst(input.key, value, input);
    },
  };
}

/**
 * Construye el `UsagePort` ligado a una organización. v0: escribe el evento en
 * el ledger sin afectar enforcement (overage diferido al engine).
 */
export function makeUsagePort(db: Db, organizationId: string): UsagePort {
  return {
    async record(metric, quantity = 1) {
      await db.insert(schema.usageEvent).values({
        id: crypto.randomUUID(),
        organizationId,
        metric,
        quantity,
      });
    },
  };
}

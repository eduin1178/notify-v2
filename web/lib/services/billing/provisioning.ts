/**
 * Aprovisionamiento de suscripciones. Funciones de bajo nivel (reciben `db`
 * explícito) para poder invocarse desde el hook de alta de organización de
 * better-auth y desde el backfill, sin requerir un `ServiceContext` completo.
 *
 * Módulo puro: NO importa `next/*`, `hono`, `@hono/*` ni `web/app/**`.
 */

import { eq, isNull } from "drizzle-orm";

import type { db as DbClient } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";
import { DEFAULT_PLAN_KEY } from "@/lib/services/billing/catalog";

type Db = typeof DbClient;

async function trialPlanId(db: Db): Promise<string> {
  const rows = await db
    .select({ id: schema.plan.id })
    .from(schema.plan)
    .where(eq(schema.plan.key, DEFAULT_PLAN_KEY))
    .limit(1);
  if (!rows[0]) {
    throw new Error(
      `No existe el plan '${DEFAULT_PLAN_KEY}'. Ejecuta el seed del catálogo antes de aprovisionar.`,
    );
  }
  return rows[0].id;
}

/**
 * Garantiza que una organización tenga suscripción Trial. Idempotente: si ya
 * existe una suscripción para la org, no hace nada.
 */
export async function ensureTrialSubscription(
  db: Db,
  organizationId: string,
): Promise<void> {
  const existing = await db
    .select({ id: schema.subscription.id })
    .from(schema.subscription)
    .where(eq(schema.subscription.organizationId, organizationId))
    .limit(1);

  if (existing[0]) return;

  const planId = await trialPlanId(db);
  await db.insert(schema.subscription).values({
    id: crypto.randomUUID(),
    organizationId,
    planId,
    status: "trialing",
  });
}

/**
 * Backfill: crea suscripción Trial para todas las organizaciones que aún no
 * tengan una. Devuelve cuántas suscripciones se crearon.
 */
export async function backfillTrialSubscriptions(db: Db): Promise<number> {
  const orgsSinSub = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .leftJoin(
      schema.subscription,
      eq(schema.subscription.organizationId, schema.organization.id),
    )
    .where(isNull(schema.subscription.id));

  if (orgsSinSub.length === 0) return 0;

  const planId = await trialPlanId(db);
  await db.insert(schema.subscription).values(
    orgsSinSub.map((o) => ({
      id: crypto.randomUUID(),
      organizationId: o.id,
      planId,
      status: "trialing" as const,
    })),
  );
  return orgsSinSub.length;
}

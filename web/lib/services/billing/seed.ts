/**
 * Seed idempotente del catálogo de planes y sus entitlements.
 *
 * Re-ejecutarlo NO duplica planes ni límites: hace upsert por `plan.key` y por
 * (`plan_entitlement.plan_id`, `key`). Módulo puro (recibe `db` explícito).
 */

import { and, eq } from "drizzle-orm";

import type { db as DbClient } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";
import { PLAN_CATALOG } from "@/lib/services/billing/catalog";

type Db = typeof DbClient;

export async function seedPlanCatalog(db: Db): Promise<void> {
  for (const planSeed of PLAN_CATALOG) {
    // Upsert del plan por su key estable.
    const existing = await db
      .select({ id: schema.plan.id })
      .from(schema.plan)
      .where(eq(schema.plan.key, planSeed.key))
      .limit(1);

    let planId: string;
    if (existing[0]) {
      planId = existing[0].id;
      await db
        .update(schema.plan)
        .set({
          name: planSeed.name,
          priceUsd: planSeed.priceUsd,
          sortOrder: planSeed.sortOrder,
          active: true,
          updatedAt: new Date(),
        })
        .where(eq(schema.plan.id, planId));
    } else {
      planId = crypto.randomUUID();
      await db.insert(schema.plan).values({
        id: planId,
        key: planSeed.key,
        name: planSeed.name,
        priceUsd: planSeed.priceUsd,
        sortOrder: planSeed.sortOrder,
        active: true,
      });
    }

    // Upsert de cada entitlement del plan.
    for (const [key, value] of Object.entries(planSeed.entitlements)) {
      const intValue = value.int ?? null;
      const boolValue = value.bool ?? null;

      const existingEnt = await db
        .select({ id: schema.planEntitlement.id })
        .from(schema.planEntitlement)
        .where(
          and(
            eq(schema.planEntitlement.planId, planId),
            eq(schema.planEntitlement.key, key),
          ),
        )
        .limit(1);

      if (existingEnt[0]) {
        await db
          .update(schema.planEntitlement)
          .set({ intValue, boolValue })
          .where(eq(schema.planEntitlement.id, existingEnt[0].id));
      } else {
        await db.insert(schema.planEntitlement).values({
          id: crypto.randomUUID(),
          planId,
          key,
          intValue,
          boolValue,
        });
      }
    }
  }
}

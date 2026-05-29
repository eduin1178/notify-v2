/**
 * Autorización del entitlement `seats` (asientos = filas en `member`).
 *
 * Un asiento equivale a una membresía existente: un usuario suspendido a nivel
 * plataforma sigue ocupando su asiento. Por eso los puntos que incrementan
 * asientos son invitar / agregar / aceptar invitación; la reactivación de un
 * usuario no altera el conteo.
 *
 * Helper puro (recibe `db` explícito) para invocarse desde los hooks de
 * better-auth, que traducen la decisión a su propio error de transporte.
 */

import { count, eq } from "drizzle-orm";

import type { db as DbClient } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";
import { makeEntitlementsPort } from "@/lib/services/billing/adapter";
import type { EntitlementDecision } from "@/lib/services/billing/ports";

type Db = typeof DbClient;

/** Conteo actual de asientos ocupados (miembros) de una organización. */
export async function countSeats(db: Db, organizationId: string): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(schema.member)
    .where(eq(schema.member.organizationId, organizationId));
  return rows[0]?.value ?? 0;
}

/**
 * Decide si la organización puede sumar `delta` asientos según su límite efectivo.
 * Devuelve la decisión; NO lanza (el llamante traduce a su transporte).
 */
export async function seatDecision(
  db: Db,
  organizationId: string,
  delta = 1,
): Promise<EntitlementDecision> {
  const current = await countSeats(db, organizationId);
  const port = makeEntitlementsPort(db, organizationId);
  return port.authorize({ key: "seats", current, delta });
}

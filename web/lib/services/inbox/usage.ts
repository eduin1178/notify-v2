/**
 * Medición de uso del inbox (design D7).
 *
 * Se mide TODO mensaje (entrante y saliente, plantilla y servicio) en el ledger
 * `usage_event` con métrica `message`, deduplicado por WAMID mediante la tabla
 * `inbox_message_usage` (su PK es el ancla idempotente: una vez por WAMID). Se
 * registra además una métrica `conversation` por cada apertura de ventana de
 * 24h, SOLO para analítica. El inbox NO bloquea por cupo.
 *
 * Opera con el cliente `db` directamente (lo invoca la ingestión por webhook, que
 * no tiene `TenantServiceContext`).
 */

import type { db as DbClient } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";

type Db = typeof DbClient;

/**
 * Registra el uso de un mensaje, una sola vez por WAMID. Devuelve `true` si fue
 * la primera vez (se contó) y `false` si era un duplicado (no se contó de nuevo).
 */
export async function recordMessageUsage(
  db: Db,
  params: {
    organizationId: string;
    wamid: string;
    direction: "inbound" | "outbound";
  },
): Promise<boolean> {
  const inserted = await db
    .insert(schema.inboxMessageUsage)
    .values({
      wamid: params.wamid,
      organizationId: params.organizationId,
      direction: params.direction,
    })
    .onConflictDoNothing()
    .returning({ wamid: schema.inboxMessageUsage.wamid });

  // Duplicado (mismo WAMID por reentrega/lote): no se cuenta de nuevo.
  if (inserted.length === 0) return false;

  await db.insert(schema.usageEvent).values({
    id: crypto.randomUUID(),
    organizationId: params.organizationId,
    metric: "message",
    quantity: 1,
  });
  return true;
}

/** Registra la apertura de una ventana de conversación de 24h (analítica). */
export async function recordConversationWindow(
  db: Db,
  organizationId: string,
): Promise<void> {
  await db.insert(schema.usageEvent).values({
    id: crypto.randomUUID(),
    organizationId,
    metric: "conversation",
    quantity: 1,
  });
}

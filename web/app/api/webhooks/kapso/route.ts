import crypto from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { verifyKapsoSignature } from "@/lib/integrations/kapso/webhook";
import { consoleLogger } from "@/lib/services/logger";
import {
  applyPhoneNumberCreated,
  applyPhoneNumberDeleted,
} from "@/lib/services/whatsapp/service";

// node:crypto requiere runtime Node (no Edge).
export const runtime = "nodejs";

const SIGNATURE_HEADER = "x-webhook-signature";
const IDEMPOTENCY_HEADER = "x-idempotency-key";

type KapsoWebhookData = {
  phone_number_id?: string;
  business_account_id?: string | null;
  display_phone_number?: string | null;
  customer?: { id?: string } | null;
};

function extract(parsed: unknown): { event: string; data: KapsoWebhookData } {
  const body = (parsed ?? {}) as Record<string, unknown>;
  const event = typeof body.event === "string" ? body.event : "";
  // v2: { event, data }. Defensivo: si no hay `data`, usar el top-level.
  const data = (body.data ?? body) as KapsoWebhookData;
  return { event, data };
}

async function alreadyProcessed(key: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.whatsappWebhookEvent.id })
    .from(schema.whatsappWebhookEvent)
    .where(eq(schema.whatsappWebhookEvent.idempotencyKey, key))
    .limit(1);
  return Boolean(rows[0]);
}

async function markProcessed(key: string, event: string): Promise<void> {
  try {
    await db.insert(schema.whatsappWebhookEvent).values({
      id: crypto.randomUUID(),
      idempotencyKey: key,
      event,
    });
  } catch {
    // Violación de unicidad por carrera concurrente: ya quedó registrado.
  }
}

export async function POST(request: Request): Promise<Response> {
  // 1) Cuerpo CRUDO: la firma se valida sobre el string EXACTO recibido.
  //    NO usar request.json() antes, ni re-serializar (cambiaría los bytes).
  const rawBody = await request.text();
  const signature = request.headers.get(SIGNATURE_HEADER);

  if (!verifyKapsoSignature(rawBody, signature, env.KAPSO_WEBHOOK_SECRET)) {
    return new Response("Invalid signature", { status: 401 });
  }

  // 2) Parsear SOLO tras verificar la firma.
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { event, data } = extract(parsed);
  const idempotencyKey = request.headers.get(IDEMPOTENCY_HEADER);

  // 3) Idempotencia DB-backed (cuando Kapso envía la cabecera).
  if (idempotencyKey && (await alreadyProcessed(idempotencyKey))) {
    return new Response("Already processed", { status: 200 });
  }

  const deps = { db, logger: consoleLogger };
  const customerId = data.customer?.id;
  const phoneNumberId = data.phone_number_id;

  try {
    if (event === "whatsapp.phone_number.created") {
      if (customerId && phoneNumberId) {
        await applyPhoneNumberCreated(deps, {
          customerId,
          phoneNumberId,
          businessAccountId: data.business_account_id ?? null,
          displayPhoneNumber: data.display_phone_number ?? null,
        });
      }
    } else if (event === "whatsapp.phone_number.deleted") {
      if (customerId && phoneNumberId) {
        await applyPhoneNumberDeleted(deps, { customerId, phoneNumberId });
      }
    } else {
      consoleLogger.info("[kapso-webhook] evento ignorado", { event });
    }
  } catch (err) {
    consoleLogger.error("[kapso-webhook] fallo procesando evento", {
      event,
      error: err instanceof Error ? err.message : String(err),
    });
    // 500 → Kapso reintenta ante fallos transitorios (p. ej. de BD).
    return new Response("Processing error", { status: 500 });
  }

  if (idempotencyKey) await markProcessed(idempotencyKey, event);

  return new Response("OK", { status: 200 });
}

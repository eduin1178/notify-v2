import crypto from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { ensureMessageWebhook } from "@/lib/integrations/kapso/client";
import { verifyKapsoSignature } from "@/lib/integrations/kapso/webhook";
import { consoleLogger } from "@/lib/services/logger";
import {
  ingestDeliveryStatus,
  ingestInboundMessage,
  type DeliveryStatusPayload,
  type InboundMessagePayload,
} from "@/lib/services/inbox/service";
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

/** Nombre del evento: `event` (no-batch) o `type` (formato batch). */
function extractEvent(parsed: unknown): string {
  const body = (parsed ?? {}) as Record<string, unknown>;
  if (typeof body.event === "string") return body.event;
  if (typeof body.type === "string") return body.type;
  return "";
}

/**
 * Payloads de mensaje/conversación. Soporta el formato batch de Kapso
 * (`{ batch: true, data: [...] }`) y el simple (`{ event, data: {...} }`).
 */
function messagePayloads(parsed: unknown): Record<string, unknown>[] {
  const body = (parsed ?? {}) as Record<string, unknown>;
  if (body.batch === true && Array.isArray(body.data)) {
    return body.data as Record<string, unknown>[];
  }
  return [(body.data ?? body) as Record<string, unknown>];
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

  const event = extractEvent(parsed);
  const idempotencyKey = request.headers.get(IDEMPOTENCY_HEADER);

  // 3) Idempotencia DB-backed (cuando Kapso envía la cabecera).
  if (idempotencyKey && (await alreadyProcessed(idempotencyKey))) {
    return new Response("Already processed", { status: 200 });
  }

  const deps = { db, logger: consoleLogger };

  try {
    if (event === "whatsapp.phone_number.created") {
      const { data } = extract(parsed);
      const customerId = data.customer?.id;
      const phoneNumberId = data.phone_number_id;
      if (customerId && phoneNumberId) {
        await applyPhoneNumberCreated(deps, {
          customerId,
          phoneNumberId,
          businessAccountId: data.business_account_id ?? null,
          displayPhoneNumber: data.display_phone_number ?? null,
        });
        // Suscripción automática a eventos de mensaje por número (inbox, D3).
        // No debe tumbar el webhook si Kapso falla → try/catch local.
        try {
          await ensureMessageWebhook(
            phoneNumberId,
            `${env.BETTER_AUTH_URL}/api/webhooks/kapso`,
          );
        } catch (e) {
          consoleLogger.warn(
            "[kapso-webhook] no se pudo registrar el webhook de mensajes",
            {
              phoneNumberId,
              error: e instanceof Error ? e.message : String(e),
            },
          );
        }
      }
    } else if (event === "whatsapp.phone_number.deleted") {
      const { data } = extract(parsed);
      const customerId = data.customer?.id;
      const phoneNumberId = data.phone_number_id;
      if (customerId && phoneNumberId) {
        await applyPhoneNumberDeleted(deps, { customerId, phoneNumberId });
      }
    } else if (event === "whatsapp.message.received") {
      for (const p of messagePayloads(parsed)) {
        await ingestInboundMessage(deps, p as InboundMessagePayload);
      }
    } else if (
      event === "whatsapp.message.sent" ||
      event === "whatsapp.message.delivered" ||
      event === "whatsapp.message.read" ||
      event === "whatsapp.message.failed"
    ) {
      for (const p of messagePayloads(parsed)) {
        await ingestDeliveryStatus(deps, p as DeliveryStatusPayload);
      }
    } else if (
      event === "whatsapp.conversation.created" ||
      event === "whatsapp.conversation.ended" ||
      event === "whatsapp.conversation.inactive"
    ) {
      // Informativo en la Fase 1: el estado de negocio es propio de Notify.
      consoleLogger.info("[kapso-webhook] evento de conversación", { event });
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

/**
 * Lógica de dominio de la autorización de suscripciones de realtime
 * (change `inbox-realtime-centrifugo`, design D5, tasks 5.2/5.4).
 *
 * La autorización por canal es regla de dominio (rule #4: no vive en las rutas).
 * El firmado del JWT sí vive en el adaptador (`lib/integrations/centrifugo/tokens`),
 * porque es transporte/cripto, no dominio.
 *
 * Módulo puro: NO importa `next/*`, `hono`, `@hono/*`, SDKs ni `web/app/**`.
 */

import { and, eq } from "drizzle-orm";

import { schema } from "@/lib/db/schema";
import type { TenantServiceContext } from "@/lib/services/context";
import { DomainErrors } from "@/lib/services/errors";
import { parseInboxChannel } from "@/lib/services/realtime/channels";

/**
 * Autoriza la suscripción a un canal del inbox para la organización del `ctx`
 * (la del path REST). Devuelve el canal validado o lanza `DomainError`.
 *
 * - `notify_inbox:org.<id>`: el id DEBE ser la org activa.
 * - `notify_inbox:conv.<id>`: la conversación DEBE pertenecer a la org activa
 *   (se verifica contra el índice local para evitar fuga cross-org por id
 *   adivinado, task 5.4).
 */
export async function authorizeInboxSubscription(
  ctx: TenantServiceContext,
  channel: string,
): Promise<string> {
  const parsed = parseInboxChannel(channel);
  if (!parsed) {
    throw DomainErrors.validation("Canal de suscripción no válido.");
  }

  if (parsed.kind === "org") {
    if (parsed.orgId !== ctx.currentOrg.id) {
      throw DomainErrors.forbidden(
        "No puedes suscribirte a canales de otra organización.",
      );
    }
    return channel;
  }

  // conv.<id>: la conversación debe ser de esta organización.
  const rows = await ctx.db
    .select({ id: schema.conversation.id })
    .from(schema.conversation)
    .where(
      and(
        eq(schema.conversation.id, parsed.conversationId),
        eq(schema.conversation.organizationId, ctx.currentOrg.id),
      ),
    )
    .limit(1);

  if (!rows[0]) {
    // 403 (no 404) para no revelar la existencia de conversaciones ajenas.
    throw DomainErrors.forbidden(
      "No puedes suscribirte a esta conversación.",
    );
  }

  return channel;
}

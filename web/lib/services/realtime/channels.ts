/**
 * Nombres de canal del realtime del inbox (change `inbox-realtime-centrifugo`,
 * design D4). Reutilizable por la publicación (servicio, capa pura) y por la
 * validación de los subscription tokens (rutas REST).
 *
 * Namespace `notify_inbox`. Sin el carácter `#` (en Centrífugo delimita canales
 * limitados por user-id). El aislamiento multi-tenant lo garantiza el
 * subscription token, no el nombre del canal.
 *
 * Vive en la capa de servicios (no en integraciones) porque el nombre de canal
 * es conocimiento de dominio puro, sin I/O ni SDK, y la capa pura lo necesita
 * para publicar. Módulo puro: NO importa `next/*`, `hono`, `@hono/*` ni `web/app/**`.
 */

export const INBOX_NAMESPACE = "notify_inbox";

/** Canal de la lista de conversaciones de una organización. */
export function orgChannel(orgId: string): string {
  return `${INBOX_NAMESPACE}:org.${orgId}`;
}

/** Canal del hilo de una conversación. */
export function convChannel(conversationId: string): string {
  return `${INBOX_NAMESPACE}:conv.${conversationId}`;
}

/**
 * Interpreta un nombre de canal del inbox. Devuelve `null` si no pertenece al
 * namespace o no tiene una forma conocida (`org.<id>` / `conv.<id>`).
 */
export function parseInboxChannel(
  channel: string,
): { kind: "org"; orgId: string } | { kind: "conv"; conversationId: string } | null {
  const prefix = `${INBOX_NAMESPACE}:`;
  if (!channel.startsWith(prefix)) return null;
  const rest = channel.slice(prefix.length);

  if (rest.startsWith("org.")) {
    const orgId = rest.slice("org.".length);
    return orgId ? { kind: "org", orgId } : null;
  }
  if (rest.startsWith("conv.")) {
    const conversationId = rest.slice("conv.".length);
    return conversationId ? { kind: "conv", conversationId } : null;
  }
  return null;
}

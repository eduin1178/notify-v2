/**
 * Reglas de la ventana de servicio de 24 horas de Meta (design D6).
 *
 * Módulo PURO: no importa nada de la app. La ventana se deriva exclusivamente de
 * `last_inbound_at`: cierra en `last_inbound_at + 24h`. Una conversación sin
 * entrante previo (proactiva) NO tiene ventana abierta.
 */

export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Instante en que cierra la ventana, o `null` si no hay entrante previo. */
export function windowClosesAt(lastInboundAt: Date | null): Date | null {
  if (!lastInboundAt) return null;
  return new Date(lastInboundAt.getTime() + SERVICE_WINDOW_MS);
}

/** ¿La ventana de servicio está abierta ahora? */
export function isWindowOpen(
  lastInboundAt: Date | null,
  now: Date = new Date(),
): boolean {
  const closesAt = windowClosesAt(lastInboundAt);
  return closesAt ? now.getTime() < closesAt.getTime() : false;
}

/** Milisegundos restantes de ventana (0 si está cerrada o no existe). */
export function remainingMs(
  lastInboundAt: Date | null,
  now: Date = new Date(),
): number {
  const closesAt = windowClosesAt(lastInboundAt);
  if (!closesAt) return 0;
  return Math.max(0, closesAt.getTime() - now.getTime());
}

/**
 * ¿El entrante que llega `now` ABRE una nueva ventana de servicio? Sí cuando no
 * había ventana previa o la anterior ya estaba cerrada. Sirve para contar la
 * métrica de conversaciones (analítica, design D7).
 */
export function opensNewWindow(
  previousLastInboundAt: Date | null,
  now: Date = new Date(),
): boolean {
  return !isWindowOpen(previousLastInboundAt, now);
}

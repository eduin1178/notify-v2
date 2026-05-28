/**
 * Logger mínimo para la capa de servicios.
 *
 * Reemplazable en el futuro por una integración real (Pino, OpenTelemetry, etc.)
 * sin tocar los servicios — sólo el cableado del `ServiceContext`.
 */

export type Logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
};

function fmt(meta?: Record<string, unknown>): string {
  if (!meta || Object.keys(meta).length === 0) return "";
  try {
    return " " + JSON.stringify(meta);
  } catch {
    return "";
  }
}

export const consoleLogger: Logger = {
  debug: (msg, meta) => console.debug("[svc]", msg + fmt(meta)),
  info: (msg, meta) => console.info("[svc]", msg + fmt(meta)),
  warn: (msg, meta) => console.warn("[svc]", msg + fmt(meta)),
  error: (msg, meta) => console.error("[svc]", msg + fmt(meta)),
};

/**
 * Adaptador del puerto `RealtimePublisher` contra la HTTP API de Centrífugo v6
 * (change `inbox-realtime-centrifugo`, design D1/D2).
 *
 * Publica con `POST {CENTRIFUGO_API_URL}/api/publish`, header `X-API-Key` y
 * cuerpo `{ channel, data }`. La publicación es **best-effort**: cualquier fallo
 * se captura y se loguea, NUNCA se propaga (no debe tumbar el webhook ni forzar
 * reintentos de Kapso). Si el entorno no está configurado, se devuelve el no-op.
 *
 * No es un módulo de servicios: lo consume el puente que construye el `ctx`/deps
 * (`lib/api/build-ctx.ts`, `lib/api/server-ctx.ts`, el webhook). No importa
 * `next/*`, `hono`, `@hono/*` ni `web/app/**`.
 */

import { env } from "@/lib/env";
import type { Logger } from "@/lib/services/logger";
import { consoleLogger } from "@/lib/services/logger";
import {
  noopRealtimePublisher,
  type RealtimePublisher,
} from "@/lib/services/realtime/ports";

/**
 * Construye la URL de publish tolerando que `CENTRIFUGO_API_URL` venga con o sin
 * el sufijo `/api` (en la red interna suele configurarse como `.../api`). Quita
 * barras finales y un `/api` final para evitar `/api/api/publish`.
 */
function publishUrl(apiUrl: string): string {
  const base = apiUrl.replace(/\/+$/, "").replace(/\/api$/, "");
  return `${base}/api/publish`;
}

/** ¿El entorno tiene la configuración mínima para publicar a Centrífugo? */
export function isCentrifugoConfigured(): boolean {
  return Boolean(env.CENTRIFUGO_API_URL && env.CENTRIFUGO_API_KEY);
}

function createCentrifugoPublisher(
  apiUrl: string,
  apiKey: string,
  logger: Logger,
): RealtimePublisher {
  const url = publishUrl(apiUrl);
  return {
    async publish(channel: string, data: unknown): Promise<void> {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
          },
          body: JSON.stringify({ channel, data }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          logger.warn("[centrifugo] publish no-OK", {
            channel,
            status: res.status,
            body: body.slice(0, 200),
          });
        }
      } catch (err) {
        // Best-effort: el dato ya está persistido; el fallback de polling cubre
        // el hueco. No propagar.
        logger.warn("[centrifugo] publish falló", {
          channel,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

/**
 * Devuelve el publicador real si Centrífugo está configurado, o el no-op en caso
 * contrario (degradación con gracia). Se llama al construir el `ctx`/deps.
 */
let warnedNoConfig = false;

export function resolveRealtimePublisher(
  logger: Logger = consoleLogger,
): RealtimePublisher {
  if (!env.CENTRIFUGO_API_URL || !env.CENTRIFUGO_API_KEY) {
    // Aviso (una vez por proceso): sin estas variables NO se publica nada a
    // Centrífugo. El navegador igual conecta el WS y se suscribe (usan
    // NEXT_PUBLIC_CENTRIFUGO_WS_URL + CENTRIFUGO_TOKEN_HMAC_SECRET), pero nunca
    // llegará una publicación → el inbox queda solo con el polling de respaldo.
    if (!warnedNoConfig) {
      warnedNoConfig = true;
      logger.warn(
        "[centrifugo] publish deshabilitado: faltan CENTRIFUGO_API_URL y/o CENTRIFUGO_API_KEY.",
        {
          hasApiUrl: Boolean(env.CENTRIFUGO_API_URL),
          hasApiKey: Boolean(env.CENTRIFUGO_API_KEY),
        },
      );
    }
    return noopRealtimePublisher;
  }
  return createCentrifugoPublisher(
    env.CENTRIFUGO_API_URL,
    env.CENTRIFUGO_API_KEY,
    logger,
  );
}

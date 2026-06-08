/**
 * Puerto de publicación de realtime, desacoplado del transporte (change
 * `inbox-realtime-centrifugo`, design D1).
 *
 * La capa de servicios depende de esta INTERFAZ (vía `ctx`/deps), nunca de la
 * implementación concreta. El adaptador que habla con la HTTP API de Centrífugo
 * vive en `lib/integrations/centrifugo/` y se inyecta al construir el `ctx` o
 * los `deps` del webhook. En pruebas (o cuando Centrífugo no está configurado)
 * se inyecta el no-op de abajo.
 *
 * Módulo puro: NO importa `next/*`, `hono`, `@hono/*`, SDKs de I/O ni `web/app/**`.
 */

/** Publica un evento efímero en un canal. Best-effort: nunca debe propagar. */
export interface RealtimePublisher {
  publish(channel: string, data: unknown): Promise<void>;
}

/**
 * Implementación no-op del puerto. Se usa en pruebas y cuando Centrífugo no está
 * configurado, de modo que los servicios que publican se ejecutan sin contactar
 * ningún transporte.
 */
export const noopRealtimePublisher: RealtimePublisher = {
  async publish(): Promise<void> {
    // Intencionalmente vacío: realtime no disponible → degradación con gracia.
  },
};

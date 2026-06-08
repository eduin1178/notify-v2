/**
 * Schemas de request/response de los endpoints de tokens de realtime
 * (change `inbox-realtime-centrifugo`, task 5.3). Se reutilizan en `createRoute`
 * de Hono. Módulo puro.
 */

import { z } from "zod";

/** Respuesta de `POST /realtime/connection-token`. */
export const ConnectionTokenResponse = z.object({
  token: z.string(),
});

/** Body de `POST /orgs/:orgId/realtime/subscription-token`. */
export const SubscriptionTokenInput = z.object({
  channel: z.string().min(1),
});

/** Respuesta del subscription token. */
export const SubscriptionTokenResponse = z.object({
  token: z.string(),
});

export type ConnectionTokenResponseT = z.infer<typeof ConnectionTokenResponse>;
export type SubscriptionTokenInputT = z.infer<typeof SubscriptionTokenInput>;
export type SubscriptionTokenResponseT = z.infer<
  typeof SubscriptionTokenResponse
>;

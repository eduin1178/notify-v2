/**
 * Firmado de los JWT que Centrífugo verifica (change `inbox-realtime-centrifugo`,
 * design D5). HS256 con `CENTRIFUGO_TOKEN_HMAC_SECRET`, que DEBE coincidir con
 * `client.token.hmac_secret_key` del Centrífugo desplegado (ver
 * `infra/centrifugo/README.md`).
 *
 * - Token de conexión: claims `{ sub, exp }`.
 * - Token de suscripción: claims `{ sub, channel, exp }`.
 *
 * Expiraciones cortas: `centrifuge-js` re-pide el token al expirar vía `getToken`.
 *
 * No es un módulo de servicios: lo consumen las rutas REST. No importa `next/*`,
 * `hono`, `@hono/*` ni `web/app/**`.
 */

import { SignJWT } from "jose";

import { env } from "@/lib/env";

/** Vida de los tokens (segundos). Corta a propósito; el cliente los renueva. */
const TOKEN_TTL_SECONDS = 600; // 10 min

class CentrifugoConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CentrifugoConfigError";
  }
}

function secretKey(): Uint8Array {
  const secret = env.CENTRIFUGO_TOKEN_HMAC_SECRET;
  if (!secret) {
    throw new CentrifugoConfigError(
      "El realtime no está configurado (falta CENTRIFUGO_TOKEN_HMAC_SECRET).",
    );
  }
  return new TextEncoder().encode(secret);
}

/** Firma el token de conexión de un usuario autenticado (`{ sub, exp }`). */
export async function signConnectionToken(userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + TOKEN_TTL_SECONDS)
    .sign(secretKey());
}

/** Firma un token de suscripción a un canal (`{ sub, channel, exp }`). */
export async function signSubscriptionToken(
  userId: string,
  channel: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ channel })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + TOKEN_TTL_SECONDS)
    .sign(secretKey());
}

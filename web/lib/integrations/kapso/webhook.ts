/**
 * Verificación de firma de webhooks de Kapso.
 *
 * HMAC SHA256 (hex) sobre el cuerpo CRUDO, comparado en tiempo constante.
 * Módulo puro (solo `node:crypto`): no importa env ni nada de la app, para que
 * sea trivial de testear. El secreto se pasa por argumento.
 */

import crypto from "node:crypto";

export function verifyKapsoSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string,
): boolean {
  if (!signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  const provided = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);

  // timingSafeEqual lanza si difieren las longitudes: las igualamos primero.
  if (provided.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(provided, expectedBuf);
}

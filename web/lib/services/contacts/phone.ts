/**
 * Normalización y validación de teléfonos a E.164.
 *
 * Módulo puro de la capa de servicios: NO importa `next/*`, `hono` ni `web/app/**`.
 * El teléfono es la identidad del contacto; debe almacenarse SIEMPRE en E.164.
 * Se exige formato internacional (con código de país): un número local sin
 * prefijo no puede convertirse de forma fiable y se considera inválido.
 */

import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Devuelve el teléfono en E.164 (p. ej. `+573001234567`) o `null` si no es
 * parseable/válido en formato internacional.
 */
export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const parsed = parsePhoneNumberFromString(raw.trim());
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

/** `true` si el teléfono puede normalizarse a E.164. */
export function isValidPhone(raw: string): boolean {
  return normalizePhone(raw) !== null;
}

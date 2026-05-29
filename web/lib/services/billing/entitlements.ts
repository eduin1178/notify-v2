/**
 * Registro de entitlement keys de Notify y su `kind` (la taxonomía de 5 tipos).
 *
 * El `kind` es estructural y vive en código (type-safe); los VALORES (límites por
 * plan) viven en DB (`plan_entitlement`). Ver design D3 del change `add-billing-seam`.
 *
 * Regla de la capa: este módulo es puro. NO importa `next/*`, `hono`, `@hono/*`
 * ni nada bajo `web/app/**`.
 */

/**
 * Taxonomía de entitlements:
 * - `metered_quota`: cupo medido por ciclo con posible overage (p. ej. mensajes).
 *   El `current` lo resuelve billing desde el ledger de uso, no la feature.
 * - `counted_cap`: tope por conteo (p. ej. números, asientos, automatizaciones
 *   activas). La feature aporta el `current`.
 * - `boolean`: feature on/off por plan.
 * - `unlimited`: sin límite; la autorización siempre permite.
 * - `metadata`: dato informativo sin enforcement (p. ej. SLA de respuesta).
 */
export type EntitlementKind =
  | "metered_quota"
  | "counted_cap"
  | "boolean"
  | "unlimited"
  | "metadata";

export type EntitlementKey =
  | "messages_quota"
  | "whatsapp_numbers"
  | "seats"
  | "active_automations"
  | "active_agents"
  | "notifications_email"
  | "notifications_whatsapp"
  | "mass_campaigns"
  | "support_email"
  | "support_whatsapp"
  | "contacts"
  | "sla_response_hours";

/**
 * Mapa key → kind. Fuente de verdad estructural del enforcement.
 */
export const ENTITLEMENTS: Record<EntitlementKey, EntitlementKind> = {
  messages_quota: "metered_quota",
  whatsapp_numbers: "counted_cap",
  seats: "counted_cap",
  active_automations: "counted_cap",
  active_agents: "counted_cap",
  notifications_email: "boolean",
  notifications_whatsapp: "boolean",
  mass_campaigns: "boolean",
  support_email: "boolean",
  support_whatsapp: "boolean",
  contacts: "unlimited",
  sla_response_hours: "metadata",
};

export const ENTITLEMENT_KEYS = Object.keys(ENTITLEMENTS) as EntitlementKey[];

export function kindOf(key: EntitlementKey): EntitlementKind {
  return ENTITLEMENTS[key];
}

export function isEntitlementKey(value: string): value is EntitlementKey {
  return value in ENTITLEMENTS;
}

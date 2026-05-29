/**
 * Catálogo de planes de Notify como dato (fuente del seed).
 *
 * Refleja la tabla de precios en USD. Estos valores se PERSISTEN en DB y son
 * editables sin redeploy; esta constante solo siembra el estado inicial.
 * Precios de overage/adicionales se almacenan pero NO se cobran en v0 (engine).
 *
 * Módulo puro.
 */

import type { EntitlementKey } from "@/lib/services/billing/entitlements";

export type PlanKey = "trial" | "basic" | "plus" | "pro";

export type EntitlementSeedValue = { int?: number | null; bool?: boolean };

export type PlanSeed = {
  key: PlanKey;
  name: string;
  /** Precio mensual USD como string (columna numeric). */
  priceUsd: string;
  sortOrder: number;
  entitlements: Partial<Record<EntitlementKey, EntitlementSeedValue>>;
};

// Features booleanas incluidas en todos los planes.
const ALL_BOOLEANS: Partial<Record<EntitlementKey, EntitlementSeedValue>> = {
  notifications_email: { bool: true },
  notifications_whatsapp: { bool: true },
  mass_campaigns: { bool: true },
  support_email: { bool: true },
  support_whatsapp: { bool: true },
};

export const PLAN_CATALOG: PlanSeed[] = [
  {
    key: "trial",
    name: "Trial",
    priceUsd: "10",
    sortOrder: 0,
    entitlements: {
      messages_quota: { int: 2000 },
      whatsapp_numbers: { int: 1 },
      seats: { int: 1 },
      active_automations: { int: 2 },
      active_agents: { int: 1 },
      contacts: { int: null }, // ilimitado
      sla_response_hours: { int: 72 },
      ...ALL_BOOLEANS,
    },
  },
  {
    key: "basic",
    name: "Basic",
    priceUsd: "25",
    sortOrder: 1,
    entitlements: {
      messages_quota: { int: 25000 },
      whatsapp_numbers: { int: 2 },
      seats: { int: 3 },
      active_automations: { int: 5 },
      active_agents: { int: 5 },
      contacts: { int: null },
      sla_response_hours: { int: 48 },
      ...ALL_BOOLEANS,
    },
  },
  {
    key: "plus",
    name: "Plus",
    priceUsd: "50",
    sortOrder: 2,
    entitlements: {
      messages_quota: { int: 50000 },
      whatsapp_numbers: { int: 5 },
      seats: { int: 5 },
      active_automations: { int: 10 },
      active_agents: { int: 10 },
      contacts: { int: null },
      sla_response_hours: { int: 24 },
      ...ALL_BOOLEANS,
    },
  },
  {
    key: "pro",
    name: "Pro",
    priceUsd: "100",
    sortOrder: 3,
    entitlements: {
      messages_quota: { int: 100000 },
      whatsapp_numbers: { int: 10 },
      seats: { int: 10 },
      active_automations: { int: 25 },
      active_agents: { int: 25 },
      contacts: { int: null },
      sla_response_hours: { int: 12 },
      ...ALL_BOOLEANS,
    },
  },
];

export const DEFAULT_PLAN_KEY: PlanKey = "trial";

export function isPlanKey(value: string): value is PlanKey {
  return value === "trial" || value === "basic" || value === "plus" || value === "pro";
}

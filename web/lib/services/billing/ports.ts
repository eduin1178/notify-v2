/**
 * Contratos de la costura de billing: `EntitlementsPort` y `UsagePort`.
 *
 * Las features dependen de estas INTERFACES (vía `ctx`), nunca de la
 * implementación concreta. El adapter que resuelve desde DB se inyecta al
 * construir el `ctx` (ver lib/api/build-ctx.ts). Cuando llegue el engine de
 * cobro, se sustituye el adapter sin tocar las features. Ver design D1.
 *
 * Módulo puro: NO importa `next/*`, `hono`, `@hono/*` ni `web/app/**`.
 */

import type { EntitlementKey } from "@/lib/services/billing/entitlements";

/** Valor efectivo de un entitlement: entero (contable/medido) o booleano. */
export type EntitlementValue = {
  int: number | null;
  bool: boolean | null;
};

export type AuthorizeInput = {
  key: EntitlementKey;
  /**
   * Conteo actual aportado por la feature (obligatorio para `counted_cap`).
   * Para `metered_quota` lo resuelve billing desde el ledger; se ignora si se pasa.
   */
  current?: number;
  /** Incremento solicitado (por defecto 1). */
  delta?: number;
};

export type EntitlementDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: string;
      key: EntitlementKey;
      limit: number | null;
      current: number | null;
      upgradeHint?: string;
    };

/**
 * Puerto de entitlements, ligado a una organización al construirse.
 */
export interface EntitlementsPort {
  /** Autoriza una operación contra el límite efectivo de la organización. */
  authorize(input: AuthorizeInput): Promise<EntitlementDecision>;
  /** Límite efectivo (override por org ?? valor del plan) para un key. */
  effectiveLimit(key: EntitlementKey): Promise<EntitlementValue>;
}

/**
 * Puerto de registro de uso, ligado a una organización al construirse.
 * En v0 el registro NO afecta el enforcement de cupos medidos (overage diferido).
 */
export interface UsagePort {
  record(metric: string, quantity?: number): Promise<void>;
}

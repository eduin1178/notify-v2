"use server";

import { revalidatePath } from "next/cache";

import { buildServerServiceContext } from "@/lib/api/server-ctx";
import { isPlanKey } from "@/lib/services/billing/catalog";
import { isEntitlementKey } from "@/lib/services/billing/entitlements";
import {
  clearOverride,
  setOverride,
  setPlan,
} from "@/lib/services/billing/service";
import { isDomainError } from "@/lib/services/errors";

export type BillingActionState = { error?: string; ok?: boolean };

function translate(err: unknown): BillingActionState {
  if (isDomainError(err)) return { error: err.message };
  console.error("[super-admin/billing] acción falló", err);
  return { error: "No pudimos completar la operación." };
}

export async function setPlanAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const planKey = String(formData.get("planKey") ?? "");

  if (!organizationId) return { error: "Organización inválida." };
  if (!isPlanKey(planKey)) return { error: "Plan inválido." };

  try {
    const ctx = await buildServerServiceContext();
    await setPlan(ctx, organizationId, planKey);
  } catch (err) {
    return translate(err);
  }

  revalidatePath(`/super-admin/organizations/${organizationId}`);
  return { ok: true };
}

export async function setOverrideAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const key = String(formData.get("key") ?? "");
  const valueType = String(formData.get("valueType") ?? ""); // "int" | "bool"
  const rawValue = String(formData.get("value") ?? "");

  if (!organizationId) return { error: "Organización inválida." };
  if (!isEntitlementKey(key)) return { error: "Entitlement inválido." };

  let input;
  if (valueType === "bool") {
    input = { key, bool: rawValue === "true" };
  } else {
    // Vacío => ilimitado (null). En otro caso, entero no negativo.
    if (rawValue.trim() === "") {
      input = { key, int: null };
    } else {
      const parsed = Number.parseInt(rawValue, 10);
      if (Number.isNaN(parsed) || parsed < 0) {
        return { error: "El valor debe ser un entero no negativo (o vacío para ilimitado)." };
      }
      input = { key, int: parsed };
    }
  }

  try {
    const ctx = await buildServerServiceContext();
    await setOverride(ctx, organizationId, input);
  } catch (err) {
    return translate(err);
  }

  revalidatePath(`/super-admin/organizations/${organizationId}`);
  return { ok: true };
}

export async function clearOverrideAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const key = String(formData.get("key") ?? "");

  if (!organizationId) return { error: "Organización inválida." };
  if (!isEntitlementKey(key)) return { error: "Entitlement inválido." };

  try {
    const ctx = await buildServerServiceContext();
    await clearOverride(ctx, organizationId, key);
  } catch (err) {
    return translate(err);
  }

  revalidatePath(`/super-admin/organizations/${organizationId}`);
  return { ok: true };
}

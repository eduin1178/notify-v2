import { randomBytes } from "node:crypto";
import {
  runWithTenant,
  type TenantContext,
} from "../infrastructure/tenant/context";

export function makeTenantContext(
  organizationId: string,
  opts?: Partial<Omit<TenantContext, "organizationId">>,
): TenantContext {
  return {
    organizationId,
    userId: opts?.userId ?? `user_${organizationId}`,
    isSuperAdmin: opts?.isSuperAdmin ?? false,
  };
}

function freshOrgId(label: "A" | "B"): string {
  return `org_${label}_${randomBytes(4).toString("hex")}`;
}

export async function withFreshTenants<T>(
  fn: (ctxA: TenantContext, ctxB: TenantContext) => Promise<T>,
): Promise<T> {
  const ctxA = makeTenantContext(freshOrgId("A"));
  const ctxB = makeTenantContext(freshOrgId("B"));
  return fn(ctxA, ctxB);
}

export async function runInTenants<T>(
  ctxA: TenantContext,
  ctxB: TenantContext,
  steps: {
    inA: () => Promise<unknown>;
    inB: () => Promise<T>;
  },
): Promise<T> {
  await runWithTenant(ctxA, () => steps.inA());
  return runWithTenant(ctxB, () => steps.inB());
}

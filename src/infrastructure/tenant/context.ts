import { AsyncLocalStorage } from "node:async_hooks";

export type TenantContext = {
  organizationId: string;
  userId: string;
  isSuperAdmin: boolean;
};

const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return tenantStorage.run(ctx, fn);
}

export function getTenantContext(): TenantContext {
  const ctx = tenantStorage.getStore();
  if (!ctx) {
    throw new Error("TenantContext not initialized — orphan request");
  }
  return ctx;
}

export function tryGetTenantContext(): TenantContext | undefined {
  return tenantStorage.getStore();
}

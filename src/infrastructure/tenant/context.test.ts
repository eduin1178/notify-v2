import { describe, expect, it } from "vitest";
import {
  getTenantContext,
  runWithTenant,
  type TenantContext,
  tryGetTenantContext,
} from "./context";

const ctxA: TenantContext = {
  organizationId: "org_A",
  userId: "u1",
  isSuperAdmin: false,
};
const ctxB: TenantContext = {
  organizationId: "org_B",
  userId: "u2",
  isSuperAdmin: true,
};

describe("getTenantContext", () => {
  it("throws when called outside runWithTenant", () => {
    expect(() => getTenantContext()).toThrow(
      /TenantContext not initialized — orphan request/,
    );
  });

  it("returns the context when called inside runWithTenant", () => {
    const result = runWithTenant(ctxA, () => getTenantContext());
    expect(result).toEqual(ctxA);
  });
});

describe("tryGetTenantContext", () => {
  it("returns undefined when called outside runWithTenant", () => {
    expect(tryGetTenantContext()).toBeUndefined();
  });

  it("returns the context when called inside runWithTenant", () => {
    const result = runWithTenant(ctxA, () => tryGetTenantContext());
    expect(result).toEqual(ctxA);
  });
});

describe("runWithTenant", () => {
  it("nested runs — inner context takes precedence", () => {
    const result = runWithTenant(ctxA, () =>
      runWithTenant(ctxB, () => getTenantContext()),
    );
    expect(result).toEqual(ctxB);
  });

  it("after a nested run exits, the outer context is restored", () => {
    const result = runWithTenant(ctxA, () => {
      runWithTenant(ctxB, () => getTenantContext());
      return getTenantContext();
    });
    expect(result).toEqual(ctxA);
  });

  it("preserves context across Promise.resolve() boundary", async () => {
    const result = await runWithTenant(ctxA, async () => {
      await Promise.resolve();
      return getTenantContext();
    });
    expect(result).toEqual(ctxA);
  });

  it("preserves context across setTimeout boundary", async () => {
    const result = await runWithTenant(ctxA, () => {
      return new Promise<TenantContext>((resolve) => {
        setTimeout(() => resolve(getTenantContext()), 10);
      });
    });
    expect(result).toEqual(ctxA);
  });

  it("returns the value returned by the callback", () => {
    const result = runWithTenant(ctxA, () => 42);
    expect(result).toBe(42);
  });
});

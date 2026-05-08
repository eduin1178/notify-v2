import { describe, expect, it } from "vitest";
import { runWithTenant, type TenantContext } from "../../tenant/context";
import { BaseRepository, type TenantScopedTable } from "./base";

const fakeTable = {
  organizationId: { name: "organization_id" } as never,
} as unknown as TenantScopedTable;

class FakeRepo extends BaseRepository<TenantScopedTable> {
  protected readonly table = fakeTable;

  getOrgId(): string {
    return this.orgId;
  }

  buildWithOrg<T extends object>(input: T): T & { organizationId: string } {
    return this.withOrgId(input);
  }
}

const ctxA: TenantContext = {
  organizationId: "org_A",
  userId: "u1",
  isSuperAdmin: false,
};

const ctxB: TenantContext = {
  organizationId: "org_B",
  userId: "u2",
  isSuperAdmin: false,
};

describe("BaseRepository — constructor", () => {
  it("throws when instantiated outside runWithTenant", () => {
    expect(() => new FakeRepo()).toThrow(
      /TenantContext not initialized — orphan request/,
    );
  });

  it("captures organizationId from the active tenant context", () => {
    const orgId = runWithTenant(ctxA, () => new FakeRepo().getOrgId());
    expect(orgId).toBe("org_A");
  });

  it("respects an explicit ctx argument over the ALS store", () => {
    const orgId = runWithTenant(ctxA, () => new FakeRepo(ctxB).getOrgId());
    expect(orgId).toBe("org_B");
  });
});

describe("BaseRepository — withOrgId", () => {
  it("injects organizationId from the captured context", () => {
    const result = runWithTenant(ctxA, () =>
      new FakeRepo().buildWithOrg({ phone: "+57", name: "Ana" }),
    );
    expect(result).toEqual({
      phone: "+57",
      name: "Ana",
      organizationId: "org_A",
    });
  });

  it("overrides any organizationId the caller tries to provide", () => {
    const result = runWithTenant(ctxA, () =>
      new FakeRepo().buildWithOrg({
        phone: "+57",
        organizationId: "org_FORGED",
      } as { phone: string; organizationId: string }),
    );
    expect(result.organizationId).toBe("org_A");
  });
});

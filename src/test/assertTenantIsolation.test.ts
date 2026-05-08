import { afterEach, describe, expect, it } from "vitest";
import { assertTenantIsolation, type IsolationTestableRepo } from "./assertTenantIsolation";
import type { TenantContext } from "../infrastructure/tenant/context";

interface Row {
  id: string;
}

const sharedStore = new Map<string, Row[]>();

afterEach(() => {
  sharedStore.clear();
});

class CorrectInMemoryRepo implements IsolationTestableRepo<Row> {
  constructor(private readonly orgId: string) {}

  async create(input: Row): Promise<void> {
    if (!sharedStore.has(this.orgId)) sharedStore.set(this.orgId, []);
    sharedStore.get(this.orgId)!.push(input);
  }

  async findAll(): Promise<Row[]> {
    return sharedStore.get(this.orgId) ?? [];
  }
}

class BrokenInMemoryRepo implements IsolationTestableRepo<Row> {
  constructor(private readonly orgId: string) {}

  async create(input: Row): Promise<void> {
    if (!sharedStore.has(this.orgId)) sharedStore.set(this.orgId, []);
    sharedStore.get(this.orgId)!.push(input);
  }

  async findAll(): Promise<Row[]> {
    return [...sharedStore.values()].flat();
  }
}

const factoryFor =
  (Repo: new (orgId: string) => IsolationTestableRepo<Row>) =>
  (ctx: TenantContext): IsolationTestableRepo<Row> =>
    new Repo(ctx.organizationId);

describe("assertTenantIsolation", () => {
  it("passes when the repo correctly scopes by organizationId", async () => {
    await expect(
      assertTenantIsolation(factoryFor(CorrectInMemoryRepo), { id: "row-1" }),
    ).resolves.toBeUndefined();
  });

  it("detects a leak and throws with a descriptive message", async () => {
    await expect(
      assertTenantIsolation(factoryFor(BrokenInMemoryRepo), { id: "row-1" }),
    ).rejects.toThrow(/Tenant isolation breach: org_B saw 1 row\(s\) belonging to org_A/);
  });
});

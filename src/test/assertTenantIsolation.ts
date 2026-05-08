import {
  runWithTenant,
  type TenantContext,
} from "../infrastructure/tenant/context";
import { withFreshTenants } from "./factories";

export interface IsolationTestableRepo<T> {
  create(input: T): Promise<void>;
  findAll(): Promise<unknown[]>;
}

export async function assertTenantIsolation<T>(
  repoFactory: (ctx: TenantContext) => IsolationTestableRepo<T>,
  sample: T,
): Promise<void> {
  await withFreshTenants(async (ctxA, ctxB) => {
    await runWithTenant(ctxA, async () => {
      await repoFactory(ctxA).create(sample);
    });

    const rowsSeenInB = await runWithTenant(ctxB, async () =>
      repoFactory(ctxB).findAll(),
    );

    if (rowsSeenInB.length > 0) {
      throw new Error(
        `Tenant isolation breach: org_B saw ${rowsSeenInB.length} row(s) belonging to org_A`,
      );
    }
  });
}

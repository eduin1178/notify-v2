import { eq, type SQL } from "drizzle-orm";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";

import {
  getTenantContext,
  tryGetTenantContext,
  type TenantContext,
} from "../../tenant/context";
import { getDbTx } from "../client";

export interface TenantScopedTable {
  organizationId: Parameters<typeof eq>[0];
}

export abstract class BaseRepository<TTable extends TenantScopedTable> {
  protected abstract readonly table: TTable;
  protected readonly orgId: string;

  constructor(ctx: TenantContext = getTenantContext()) {
    this.orgId = ctx.organizationId;
  }

  protected scopedWhere(): SQL {
    return eq(this.table.organizationId, this.orgId);
  }

  protected withOrgId<T extends object>(
    input: T,
  ): T & { organizationId: string } {
    return { ...input, organizationId: this.orgId };
  }
}

type TxClient = Parameters<Parameters<NeonDatabase["transaction"]>[0]>[0];

export async function withTransaction<T>(
  fn: (tx: TxClient) => Promise<T>,
): Promise<T> {
  if (!tryGetTenantContext()) {
    throw new Error("TenantContext not initialized — orphan request");
  }
  const dbTx = await getDbTx();
  return dbTx.transaction(fn);
}

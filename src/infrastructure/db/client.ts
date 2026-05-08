import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";

import { env } from "../env/env";

export const db: NeonHttpDatabase = drizzleHttp(neon(env.DATABASE_URL));

let _dbTx: NeonDatabase | undefined;

export async function getDbTx(): Promise<NeonDatabase> {
  if (_dbTx) return _dbTx;

  const [{ Pool }, { drizzle: drizzleServerless }] = await Promise.all([
    import("@neondatabase/serverless"),
    import("drizzle-orm/neon-serverless"),
  ]);

  const pool = new Pool({ connectionString: env.DATABASE_URL });
  _dbTx = drizzleServerless(pool);
  return _dbTx;
}

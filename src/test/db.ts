import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

let pool: Pool | undefined;
let db: NodePgDatabase | undefined;

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required for the test DB. Did the vitest setup file run?",
    );
  }
  return url;
}

export async function setupTestDb(): Promise<NodePgDatabase> {
  pool = new Pool({ connectionString: connectionString() });
  await pool.query('DROP SCHEMA IF EXISTS "public" CASCADE');
  await pool.query('CREATE SCHEMA "public"');

  db = drizzle(pool);
  await migrate(db, {
    migrationsFolder: "./infrastructure/db/migrations",
  });
  return db;
}

export function getTestDb(): NodePgDatabase {
  if (!db) {
    throw new Error("Test DB not initialized — call setupTestDb() first");
  }
  return db;
}

export async function teardownTestDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
  db = undefined;
}

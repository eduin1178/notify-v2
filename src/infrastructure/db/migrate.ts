import { env } from "../env/env";

const MIGRATIONS_FOLDER = "./infrastructure/db/migrations";

function isNeonUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host.endsWith(".neon.tech") || host.endsWith(".neon.dev");
  } catch {
    return false;
  }
}

async function migrateNeon(url: string): Promise<void> {
  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  const { migrate } = await import("drizzle-orm/neon-http/migrator");
  const sql = neon(url);
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

async function migrateNodePg(url: string): Promise<void> {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const url = env.DATABASE_URL;
  const driver = isNeonUrl(url) ? "neon-http" : "node-postgres";
  console.log(`Applying migrations via ${driver} → ${new URL(url).host}`);

  if (driver === "neon-http") {
    await migrateNeon(url);
  } else {
    await migrateNodePg(url);
  }

  console.log("Migrations applied.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

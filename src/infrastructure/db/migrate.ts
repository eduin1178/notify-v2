import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

import { env } from "../env/env";

async function main(): Promise<void> {
  const sql = neon(env.DATABASE_URL);
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "./infrastructure/db/migrations" });
  console.log("Migrations applied.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

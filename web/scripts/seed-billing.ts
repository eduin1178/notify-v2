/**
 * Runner del seed de billing: siembra el catálogo de planes y hace backfill de
 * suscripciones Trial para organizaciones existentes. Idempotente.
 *
 * Uso (desde web/):  pnpm db:seed
 * Requiere DATABASE_URL en el entorno.
 */

import { db } from "@/lib/db/client";
import { backfillTrialSubscriptions } from "@/lib/services/billing/provisioning";
import { seedPlanCatalog } from "@/lib/services/billing/seed";

async function main() {
  console.log("→ Sembrando catálogo de planes…");
  await seedPlanCatalog(db);
  console.log("✓ Catálogo sembrado (Trial/Basic/Plus/Pro).");

  console.log("→ Backfill de suscripciones Trial…");
  const created = await backfillTrialSubscriptions(db);
  console.log(`✓ Backfill completo: ${created} suscripción(es) creada(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("✗ Seed de billing falló:", err);
    process.exit(1);
  });

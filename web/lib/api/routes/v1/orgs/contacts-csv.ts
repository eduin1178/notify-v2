import { Hono } from "hono";

import { buildTenantServiceContext } from "@/lib/api/build-ctx";
import type { HonoEnv } from "@/lib/api/context";
import { requireSession } from "@/lib/api/middlewares/auth";
import { requireOrgMembership } from "@/lib/api/middlewares/org";
import {
  exportContactsCsv,
  importContactsCsv,
} from "@/lib/services/contacts/service";

/**
 * Rutas CSV de contactos. Se montan en un router Hono "plano" (no OpenAPI)
 * porque manejan `text/csv` en vez de JSON. DEBE montarse ANTES del router
 * OpenAPI de contactos para que `/contacts/export` no se capture como `/{id}`.
 */
export const contactsCsvRouter = new Hono<HonoEnv>()
  .get(
    "/orgs/:orgId/contacts/export",
    requireSession,
    requireOrgMembership,
    async (c) => {
      const ctx = buildTenantServiceContext(c);
      const csv = await exportContactsCsv(ctx);
      return c.body(csv, 200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="contactos.csv"',
      });
    },
  )
  .post(
    "/orgs/:orgId/contacts/import",
    requireSession,
    requireOrgMembership,
    async (c) => {
      const csv = await c.req.text();
      const ctx = buildTenantServiceContext(c);
      const report = await importContactsCsv(ctx, csv);
      return c.json(report, 200);
    },
  );

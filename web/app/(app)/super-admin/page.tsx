import type { Metadata } from "next";
import Link from "next/link";
import { count } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Plataforma · Notify",
};

export const dynamic = "force-dynamic";

export default async function SuperAdminHomePage() {
  const [userRow] = await db.select({ value: count() }).from(schema.user);
  const [orgRow] = await db.select({ value: count() }).from(schema.organization);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Panel de plataforma</h1>
        <p className="text-sm text-muted-foreground">
          Vista global de Notify. Solo accesible para administradores de plataforma.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/super-admin/users"
          className="block border border-border bg-card p-4 text-card-foreground transition-colors hover:bg-muted"
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Usuarios
          </p>
          <p className="mt-2 text-2xl font-semibold">{userRow?.value ?? 0}</p>
          <p className="mt-2 text-sm text-muted-foreground">Gestionar usuarios →</p>
        </Link>
        <Link
          href="/super-admin/organizations"
          className="block border border-border bg-card p-4 text-card-foreground transition-colors hover:bg-muted"
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Organizaciones
          </p>
          <p className="mt-2 text-2xl font-semibold">{orgRow?.value ?? 0}</p>
          <p className="mt-2 text-sm text-muted-foreground">Ver organizaciones →</p>
        </Link>
      </div>
    </section>
  );
}

import Link from "next/link";
import { eq } from "drizzle-orm";

import { loadOrgContext } from "@/lib/org/context";
import { db } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function OrgDashboardPage({
  params,
}: PageProps<"/org/[orgSlug]">) {
  const { orgSlug } = await params;
  const ctx = await loadOrgContext(orgSlug);

  const memberCount = await db
    .select({ id: schema.member.id })
    .from(schema.member)
    .where(eq(schema.member.organizationId, ctx.organization.id));

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Organización
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{ctx.organization.name}</h1>
        <p className="text-sm text-muted-foreground">
          Tu rol: <strong>{roleLabel(ctx.role)}</strong>
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="border border-border bg-card p-4 text-card-foreground">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Miembros
          </p>
          <p className="mt-2 text-2xl font-semibold">{memberCount.length}</p>
          <Link
            href={`/org/${ctx.organization.slug}/members`}
            className="mt-3 inline-block text-sm text-muted-foreground hover:text-foreground"
          >
            Gestionar miembros →
          </Link>
        </div>
        <div className="border border-border bg-card p-4 text-card-foreground">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Estado
          </p>
          <p className="mt-2 text-sm">
            Tu organización está lista. Pronto verás aquí tus notificaciones y métricas.
          </p>
        </div>
      </div>
    </section>
  );
}

function roleLabel(role: string): string {
  switch (role) {
    case "owner":
      return "Propietario";
    case "admin":
      return "Administrador";
    case "member":
    default:
      return "Miembro";
  }
}

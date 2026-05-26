import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gt } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";
import { InvitationActions } from "@/components/onboarding/invitation-actions";

export const metadata: Metadata = {
  title: "Tus invitaciones · Notify",
};

export const dynamic = "force-dynamic";

export default async function InvitationsPage() {
  const session = await requireSession();
  const email = session.user.email.trim().toLowerCase();

  const now = new Date();

  const rows = await db
    .select({
      id: schema.invitation.id,
      role: schema.invitation.role,
      expiresAt: schema.invitation.expiresAt,
      organizationName: schema.organization.name,
      organizationSlug: schema.organization.slug,
      inviterName: schema.user.name,
      inviterEmail: schema.user.email,
    })
    .from(schema.invitation)
    .innerJoin(
      schema.organization,
      eq(schema.invitation.organizationId, schema.organization.id),
    )
    .innerJoin(schema.user, eq(schema.invitation.inviterId, schema.user.id))
    .where(
      and(
        eq(schema.invitation.email, email),
        eq(schema.invitation.status, "pending"),
        gt(schema.invitation.expiresAt, now),
      ),
    );

  if (rows.length === 0) {
    return (
      <section className="space-y-6 text-center">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            No tienes invitaciones pendientes
          </h1>
          <p className="text-sm text-muted-foreground">
            Crea una organización para empezar a usar Notify.
          </p>
        </header>
        <Button asChild className="w-full">
          <Link href="/onboarding/new-org">Crear organización</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Tienes invitaciones</h1>
        <p className="text-sm text-muted-foreground">
          Acepta para unirte a una organización existente o continúa para crear la tuya.
        </p>
      </header>

      <ul className="space-y-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className="space-y-3 border border-border bg-card p-4 text-card-foreground"
          >
            <div className="space-y-1">
              <p className="font-medium">{row.organizationName}</p>
              <p className="text-sm text-muted-foreground">
                {row.inviterName} ({row.inviterEmail}) te invitó como{" "}
                <strong>{roleLabel(row.role)}</strong>.
              </p>
            </div>
            <InvitationActions invitationId={row.id} />
          </li>
        ))}
      </ul>

      <div className="border-t border-border pt-4">
        <Button asChild variant="outline" className="w-full">
          <Link href="/onboarding/new-org">Mejor crear mi propia organización</Link>
        </Button>
      </div>
    </section>
  );
}

function roleLabel(role: string | null | undefined): string {
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

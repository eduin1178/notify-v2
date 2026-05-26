import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";
import { AcceptInvitationForm } from "@/components/invitations/accept-form";
import { SignOutAndRetryButton } from "@/components/invitations/sign-out-and-retry";

export const metadata: Metadata = {
  title: "Invitación · Notify",
};

export const dynamic = "force-dynamic";

export default async function InvitationPage({
  params,
}: PageProps<"/invitations/[token]">) {
  const { token } = await params;

  const inviteRow = await db
    .select({
      id: schema.invitation.id,
      email: schema.invitation.email,
      role: schema.invitation.role,
      status: schema.invitation.status,
      expiresAt: schema.invitation.expiresAt,
      organizationId: schema.invitation.organizationId,
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
    .where(eq(schema.invitation.id, token))
    .limit(1);

  const invitation = inviteRow[0];
  const now = new Date();

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <section className="w-full max-w-md space-y-6">
        {!invitation ? (
          <StateCard
            title="Invitación no encontrada"
            description="El enlace que recibiste no corresponde a ninguna invitación activa."
            cta={<Link href="/">Ir al inicio</Link>}
          />
        ) : invitation.status !== "pending" ? (
          <StateCard
            title="Invitación ya procesada"
            description="Esta invitación ya fue aceptada, rechazada o cancelada."
            cta={<Link href="/">Ir al inicio</Link>}
          />
        ) : invitation.expiresAt.getTime() < now.getTime() ? (
          <StateCard
            title="Invitación expirada"
            description="Este enlace ya no es válido. Pide a la organización que te reenvíe una nueva invitación."
            cta={<Link href="/">Ir al inicio</Link>}
          />
        ) : (
          <PendingInvitationView token={token} invitation={invitation} />
        )}
      </section>
    </main>
  );
}

async function PendingInvitationView({
  token,
  invitation,
}: {
  token: string;
  invitation: {
    email: string;
    role: string | null;
    organizationName: string;
    organizationSlug: string;
    inviterName: string;
    inviterEmail: string;
  };
}) {
  const session = await getSession();
  const invitationEmail = invitation.email.trim().toLowerCase();
  const sessionEmail = session?.user.email.trim().toLowerCase() ?? null;

  if (!session) {
    return (
      <article className="space-y-4 text-center">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Te invitaron a {invitation.organizationName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {invitation.inviterName} ({invitation.inviterEmail}) te invitó como{" "}
            <strong>{roleLabel(invitation.role)}</strong>. Inicia sesión con{" "}
            <strong>{invitation.email}</strong> para aceptar.
          </p>
        </header>
        <Button asChild className="w-full">
          <Link href={`/sign-in?redirect=/invitations/${token}`}>Iniciar sesión</Link>
        </Button>
      </article>
    );
  }

  if (sessionEmail !== invitationEmail) {
    return (
      <article className="space-y-4 text-center">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Esta invitación es para otra cuenta
          </h1>
          <p className="text-sm text-muted-foreground">
            La invitación fue enviada a <strong>{invitation.email}</strong>, pero tu
            sesión actual es <strong>{session.user.email}</strong>. Cierra sesión y
            vuelve a entrar con la cuenta correcta.
          </p>
        </header>
        <SignOutAndRetryButton redirectTo={`/invitations/${token}`} />
      </article>
    );
  }

  return (
    <article className="space-y-4">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Te invitaron a {invitation.organizationName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {invitation.inviterName} te invitó como{" "}
          <strong>{roleLabel(invitation.role)}</strong>. ¿Aceptas unirte?
        </p>
      </header>
      <AcceptInvitationForm token={token} />
      <p className="text-center text-xs text-muted-foreground">
        Si prefieres ignorarla, simplemente cierra esta página.
      </p>
    </article>
  );
}

function StateCard({
  title,
  description,
  cta,
}: {
  title: string;
  description: string;
  cta: React.ReactNode;
}) {
  return (
    <article className="space-y-4 text-center">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>
      <Button asChild className="w-full">
        {cta}
      </Button>
    </article>
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

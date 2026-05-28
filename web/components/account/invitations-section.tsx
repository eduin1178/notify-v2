import { BuildingsIcon, CaretDownIcon } from "@phosphor-icons/react/dist/ssr";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { InvitationActions } from "@/components/account/invitation-actions";
import type { AccountInvitations, InvitationSummary } from "@/lib/account/load-invitations";

const DATE_FORMATTER = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function statusLabel(status: string): string {
  switch (status) {
    case "accepted":
      return "Aceptada";
    case "rejected":
      return "Rechazada";
    case "canceled":
      return "Cancelada";
    case "expired":
      return "Expirada";
    case "pending":
      return "Pendiente";
    default:
      return status;
  }
}

function roleLabel(role: string | null): string {
  switch (role) {
    case "owner":
      return "Propietario";
    case "admin":
      return "Administrador";
    case "member":
      return "Miembro";
    default:
      return role ?? "Miembro";
  }
}

export type InvitationsSectionProps = {
  data: AccountInvitations;
};

export function InvitationsSection({ data }: InvitationsSectionProps) {
  const { pending, closed } = data;
  const isEmpty = pending.length === 0 && closed.length === 0;

  return (
    <section className="rounded-lg border bg-card p-6">
      <header className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight">Invitaciones</h2>
        <p className="text-sm text-muted-foreground">
          Invitaciones recibidas en tu correo para unirte a otras organizaciones.
        </p>
      </header>

      {isEmpty ? (
        <p className="text-sm text-muted-foreground">No tienes invitaciones.</p>
      ) : null}

      {pending.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Pendientes</h3>
          <ul className="divide-y">
            {pending.map((inv) => (
              <InvitationRow key={inv.id} invitation={inv} pending />
            ))}
          </ul>
        </div>
      ) : null}

      {closed.length > 0 ? (
        <Collapsible className="mt-4">
          <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium">
            <span>Historial ({closed.length})</span>
            <CaretDownIcon className="size-4 transition-transform data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <ul className="divide-y">
              {closed.map((inv) => (
                <InvitationRow key={inv.id} invitation={inv} pending={false} />
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </section>
  );
}

function InvitationRow({
  invitation,
  pending,
}: {
  invitation: InvitationSummary;
  pending: boolean;
}) {
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex size-9 items-center justify-center rounded-md border bg-background">
        <BuildingsIcon weight="bold" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{invitation.organization.name}</p>
        <p className="text-xs text-muted-foreground">
          {roleLabel(invitation.role)} ·{" "}
          {pending
            ? `Expira el ${DATE_FORMATTER.format(invitation.expiresAt)}`
            : `${statusLabel(invitation.status)} · ${DATE_FORMATTER.format(invitation.expiresAt)}`}
        </p>
      </div>
      {pending ? <InvitationActions invitationId={invitation.id} /> : null}
    </li>
  );
}

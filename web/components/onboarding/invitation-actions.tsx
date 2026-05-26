"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  acceptInvitationAction,
  rejectInvitationAction,
} from "@/app/(onboarding)/onboarding/invitations/actions";

type Props = { invitationId: string };

export function InvitationActions({ invitationId }: Props) {
  const [acceptState, acceptAction] = useActionState(acceptInvitationAction, {});
  const [rejectState, rejectAction] = useActionState(rejectInvitationAction, {});

  const error = acceptState.error ?? rejectState.error ?? null;

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <form action={acceptAction} className="flex-1">
          <input type="hidden" name="invitationId" value={invitationId} />
          <SubmitButton variant="default" label="Aceptar" pendingLabel="Aceptando..." />
        </form>
        <form action={rejectAction} className="flex-1">
          <input type="hidden" name="invitationId" value={invitationId} />
          <SubmitButton variant="outline" label="Rechazar" pendingLabel="Rechazando..." />
        </form>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SubmitButton({
  variant,
  label,
  pendingLabel,
}: {
  variant: "default" | "outline";
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} className="w-full">
      {pending ? pendingLabel : label}
    </Button>
  );
}

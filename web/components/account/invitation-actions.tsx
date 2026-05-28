"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SpinnerGapIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

type Props = {
  invitationId: string;
};

export function InvitationActions({ invitationId }: Props) {
  const router = useRouter();
  const [pending, setPending] = React.useState<"accept" | "reject" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleAccept() {
    setPending("accept");
    setError(null);
    try {
      const res = (await authClient.organization.acceptInvitation({
        invitationId,
      })) as { error?: { message?: string } | null } | undefined;
      if (res?.error) {
        setError(res.error.message ?? "No pudimos aceptar la invitación.");
      } else {
        router.refresh();
      }
    } catch {
      setError("No pudimos aceptar la invitación. Inténtalo de nuevo.");
    } finally {
      setPending(null);
    }
  }

  async function handleReject() {
    setPending("reject");
    setError(null);
    try {
      const res = (await authClient.organization.rejectInvitation({
        invitationId,
      })) as { error?: { message?: string } | null } | undefined;
      if (res?.error) {
        setError(res.error.message ?? "No pudimos rechazar la invitación.");
      } else {
        router.refresh();
      }
    } catch {
      setError("No pudimos rechazar la invitación. Inténtalo de nuevo.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending !== null}
          onClick={() => void handleAccept()}
        >
          {pending === "accept" ? (
            <SpinnerGapIcon className="animate-spin" weight="bold" />
          ) : null}
          Aceptar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending !== null}
          onClick={() => void handleReject()}
        >
          {pending === "reject" ? (
            <SpinnerGapIcon className="animate-spin" weight="bold" />
          ) : null}
          Rechazar
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

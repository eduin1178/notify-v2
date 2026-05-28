"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  reactivateUserAction,
  suspendUserAction,
} from "@/app/(app)/super-admin/users/actions";

type Props = {
  userId: string;
  isSuspended: boolean;
  isSelf: boolean;
};

export function UserActions({ userId, isSuspended, isSelf }: Props) {
  const [suspendState, suspendAction] = useActionState(suspendUserAction, {});
  const [reactivateState, reactivateAction] = useActionState(reactivateUserAction, {});
  const error = suspendState.error ?? reactivateState.error ?? null;

  if (isSelf) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {isSuspended ? (
        <form action={reactivateAction}>
          <input type="hidden" name="userId" value={userId} />
          <SubmitButton label="Reactivar" pendingLabel="Reactivando..." variant="outline" />
        </form>
      ) : (
        <form action={suspendAction}>
          <input type="hidden" name="userId" value={userId} />
          <SubmitButton label="Suspender" pendingLabel="Suspendiendo..." variant="destructive" />
        </form>
      )}
      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function SubmitButton({
  label,
  pendingLabel,
  variant,
}: {
  label: string;
  pendingLabel: string;
  variant: "outline" | "destructive";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size="sm" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createOrganizationAction } from "@/app/(onboarding)/onboarding/new-org/actions";

export function NewOrgForm() {
  const [state, action] = useActionState(createOrganizationAction, {});

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nombre de la organización</Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="organization"
          maxLength={64}
          placeholder="Mi empresa"
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creando..." : "Crear organización"}
    </Button>
  );
}

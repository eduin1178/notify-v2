"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";

import { createOrganizationAction } from "@/app/(onboarding)/onboarding/new-org/actions";

export function NewOrgForm() {
  const [state, action] = useActionState(createOrganizationAction, {});

  return (
    <form action={action} className="space-y-4">
      <Field>
        <FieldLabel htmlFor="name">Nombre de la organización</FieldLabel>
        <Input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="organization"
          maxLength={64}
          placeholder="Mi empresa"
        />
      </Field>

      <FieldError className="text-sm">{state.error}</FieldError>

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

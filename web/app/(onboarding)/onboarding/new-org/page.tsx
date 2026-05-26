import type { Metadata } from "next";

import { NewOrgForm } from "@/components/onboarding/new-org-form";

export const metadata: Metadata = {
  title: "Crear organización · Notify",
};

export default function NewOrgPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Crea tu organización</h1>
        <p className="text-sm text-muted-foreground">
          Cada cuenta pertenece al menos a una organización. Elige un nombre y te
          asignaremos como propietario.
        </p>
      </header>

      <NewOrgForm />
    </section>
  );
}

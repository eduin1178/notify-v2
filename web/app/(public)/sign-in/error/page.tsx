import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "No pudimos iniciar sesión · Notify",
};

export default function SignInErrorPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <section className="w-full max-w-sm space-y-6 text-center">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            No pudimos iniciar sesión
          </h1>
          <p className="text-sm text-muted-foreground">
            Algo salió mal durante el inicio de sesión. Esto puede deberse a una
            cancelación, a un problema con el proveedor o a un acceso deshabilitado.
            Inténtalo de nuevo.
          </p>
        </header>

        <Button asChild className="w-full">
          <Link href="/sign-in">Volver a iniciar sesión</Link>
        </Button>
      </section>
    </main>
  );
}

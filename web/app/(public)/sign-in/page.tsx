import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { SignInButtons } from "@/components/auth/sign-in-buttons";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export const metadata: Metadata = {
  title: "Iniciar sesión · Notify",
};

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const session = await getSession();
  const sp = await searchParams;
  const redirectTo = typeof sp.redirect === "string" ? sp.redirect : undefined;

  if (session) {
    redirect(redirectTo && redirectTo.startsWith("/") ? redirectTo : "/post-auth");
  }

  return (
    <main className="relative flex flex-1 items-center justify-center px-4 py-16">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle align="end" />
      </div>
      <section className="w-full max-w-sm space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Inicia sesión</h1>
          <p className="text-sm text-muted-foreground">
            Continúa con tu cuenta de Google o GitHub para acceder a Notify.
          </p>
        </header>

        <SignInButtons redirectTo={redirectTo} />

        <p className="text-center text-xs text-muted-foreground">
          Al continuar aceptas los términos del servicio.
        </p>
      </section>
    </main>
  );
}

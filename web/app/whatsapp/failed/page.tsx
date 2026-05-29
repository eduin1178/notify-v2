import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "No se pudo conectar WhatsApp · Notify",
};

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  facebook_auth_failed:
    "Se canceló el inicio de sesión con Facebook. Vuelve a intentar la conexión.",
  phone_verification_failed:
    "No se pudo verificar el número de teléfono. Revisa el número e intenta de nuevo.",
  waba_limit_reached:
    "La cuenta de Meta alcanzó el máximo de cuentas de WhatsApp permitidas.",
  token_exchange_failed:
    "Falló la autorización con Meta. Vuelve a intentar la conexión.",
  link_expired:
    "El enlace de conexión expiró. Genera uno nuevo desde la sección de WhatsApp.",
  already_used:
    "Este enlace de conexión ya se usó. Genera uno nuevo si necesitas reconectar.",
};

const DEFAULT_MESSAGE =
  "No pudimos completar la conexión de WhatsApp. Vuelve a intentarlo desde la sección de WhatsApp.";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function WhatsappFailedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const code = first(sp.error_code);
  const message = (code && ERROR_MESSAGES[code]) || DEFAULT_MESSAGE;

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">No se pudo conectar WhatsApp</h1>
      <p className="text-muted-foreground">{message}</p>
      <Button asChild>
        <Link href="/post-auth">Volver a Notify</Link>
      </Button>
    </main>
  );
}

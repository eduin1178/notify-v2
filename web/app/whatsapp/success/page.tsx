import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "WhatsApp conectado · Notify",
};

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function WhatsappSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawPhone = first(sp.display_phone_number);
  const phone = rawPhone ? decodeURIComponent(rawPhone) : null;

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Conectando tu WhatsApp…</h1>
      <p className="text-muted-foreground">
        {phone
          ? `Recibimos la confirmación del número ${phone}.`
          : "Recibimos la confirmación de tu cuenta."}{" "}
        Estamos finalizando la conexión; el estado se actualizará en unos
        segundos.
      </p>
      <Button asChild>
        <Link href="/post-auth">Volver a Notify</Link>
      </Button>
    </main>
  );
}

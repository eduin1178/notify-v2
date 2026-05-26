"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/client";

export function SignOutAndRetryButton({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handle() {
    setPending(true);
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.replace(`/sign-in?redirect=${encodeURIComponent(redirectTo)}`);
          router.refresh();
        },
      },
    });
    setPending(false);
  }

  return (
    <Button type="button" className="w-full" disabled={pending} onClick={handle}>
      {pending ? "Cerrando sesión..." : "Cerrar sesión y entrar con otra cuenta"}
    </Button>
  );
}

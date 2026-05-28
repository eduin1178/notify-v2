"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SpinnerGap } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/client";

export function NavbarSignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.replace("/");
          router.refresh();
        },
      },
    });
    setPending(false);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleSignOut}
      disabled={pending}
    >
      {pending ? <SpinnerGap className="animate-spin" weight="bold" /> : null}
      Cerrar sesión
    </Button>
  );
}

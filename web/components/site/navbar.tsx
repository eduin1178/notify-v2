import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { NavbarSignOutButton } from "@/components/site/navbar-sign-out-button";

export async function Navbar() {
  const session = await getSession();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="text-base font-semibold tracking-tight">
          Notify
        </Link>
        <div className="flex items-center gap-2">
          {session ? (
            <>
              <Button asChild variant="default" size="sm">
                <Link href="/post-auth">Dashboard</Link>
              </Button>
              <NavbarSignOutButton />
            </>
          ) : (
            <Button asChild variant="default" size="sm">
              <Link href="/sign-in">Iniciar sesión</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

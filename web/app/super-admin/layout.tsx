import Link from "next/link";

import { requireSuperAdmin } from "@/lib/auth/guards";
import { UserMenu } from "@/components/app/user-menu";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSuperAdmin();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/super-admin" className="text-sm font-semibold">
              Notify · Plataforma
            </Link>
            <nav className="flex items-center gap-3 text-sm">
              <Link
                href="/super-admin/organizations"
                className="text-muted-foreground hover:text-foreground"
              >
                Organizaciones
              </Link>
              <Link
                href="/super-admin/users"
                className="text-muted-foreground hover:text-foreground"
              >
                Usuarios
              </Link>
              <Link
                href="/post-auth"
                className="text-muted-foreground hover:text-foreground"
              >
                Volver a la app
              </Link>
            </nav>
          </div>
          <UserMenu
            user={{
              name: session.user.name,
              email: session.user.email,
              image: session.user.image,
            }}
          />
        </div>
      </header>
      <main className="flex-1 px-4 py-8">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}

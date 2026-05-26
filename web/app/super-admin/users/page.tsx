import type { Metadata } from "next";
import { count, desc } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { UserActions } from "@/components/super-admin/user-actions";

export const metadata: Metadata = {
  title: "Usuarios · Plataforma · Notify",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function SuperAdminUsersPage({
  searchParams,
}: PageProps<"/super-admin/users">) {
  const actor = await requireSuperAdmin();
  const sp = await searchParams;
  const page = typeof sp.page === "string" ? sp.page : "1";
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const [totalRow] = await db.select({ value: count() }).from(schema.user);
  const total = totalRow?.value ?? 0;

  const rows = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      role: schema.user.role,
      banned: schema.user.banned,
      banExpires: schema.user.banExpires,
      createdAt: schema.user.createdAt,
    })
    .from(schema.user)
    .orderBy(desc(schema.user.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
        <p className="text-sm text-muted-foreground">{total} en total.</p>
      </header>

      <div className="border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Nombre</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Plataforma</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium">Creado</th>
              <th className="px-4 py-2 font-medium" aria-label="Acciones" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((u) => {
              const isSuspended =
                u.banned === true &&
                (!u.banExpires || u.banExpires.getTime() > Date.now());
              return (
                <tr key={u.id}>
                  <td className="px-4 py-2 font-medium">{u.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-2">
                    {u.role === "admin" ? (
                      <span className="rounded-none border border-border bg-muted px-2 py-0.5 text-xs">
                        SuperAdmin
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isSuspended ? (
                      <span className="text-xs text-destructive">Suspendido</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Activo</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {u.createdAt.toLocaleDateString("es", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <UserActions
                      userId={u.id}
                      isSuspended={isSuspended}
                      isSelf={u.id === actor.user.id}
                    />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Aún no hay usuarios.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Pagination current={pageNum} totalPages={totalPages} />
    </section>
  );
}

function Pagination({ current, totalPages }: { current: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="flex items-center justify-between text-sm">
      <a
        href={current > 1 ? `?page=${current - 1}` : undefined}
        aria-disabled={current === 1}
        className={
          current === 1
            ? "pointer-events-none text-muted-foreground"
            : "text-muted-foreground hover:text-foreground"
        }
      >
        ← Anterior
      </a>
      <span className="text-muted-foreground">
        Página {current} de {totalPages}
      </span>
      <a
        href={current < totalPages ? `?page=${current + 1}` : undefined}
        aria-disabled={current === totalPages}
        className={
          current === totalPages
            ? "pointer-events-none text-muted-foreground"
            : "text-muted-foreground hover:text-foreground"
        }
      >
        Siguiente →
      </a>
    </nav>
  );
}

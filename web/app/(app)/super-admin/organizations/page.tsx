import type { Metadata } from "next";
import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Organizaciones · Plataforma · Notify",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function SuperAdminOrganizationsPage({
  searchParams,
}: PageProps<"/super-admin/organizations">) {
  const sp = await searchParams;
  const page = typeof sp.page === "string" ? sp.page : "1";
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const [totalRow] = await db.select({ value: count() }).from(schema.organization);
  const total = totalRow?.value ?? 0;

  const rows = await db
    .select({
      id: schema.organization.id,
      name: schema.organization.name,
      slug: schema.organization.slug,
      createdAt: schema.organization.createdAt,
    })
    .from(schema.organization)
    .orderBy(desc(schema.organization.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  const enriched = await Promise.all(
    rows.map(async (org) => {
      const [c] = await db
        .select({ value: count() })
        .from(schema.member)
        .where(eq(schema.member.organizationId, org.id));
      return { ...org, members: c?.value ?? 0 };
    }),
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Organizaciones</h1>
        <p className="text-sm text-muted-foreground">{total} en total.</p>
      </header>

      <div className="border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Nombre</th>
              <th className="px-4 py-2 font-medium">Slug</th>
              <th className="px-4 py-2 font-medium">Miembros</th>
              <th className="px-4 py-2 font-medium">Creada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {enriched.map((org) => (
              <tr key={org.id}>
                <td className="px-4 py-2 font-medium">
                  <Link
                    href={`/super-admin/organizations/${org.id}`}
                    className="hover:underline"
                  >
                    {org.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{org.slug}</td>
                <td className="px-4 py-2">{org.members}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {org.createdAt.toLocaleDateString("es", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
              </tr>
            ))}
            {enriched.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Aún no hay organizaciones.
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

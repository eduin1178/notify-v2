import { eq } from "drizzle-orm";

import { loadOrgContext } from "@/lib/org/context";
import { db } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";
import { Topbar } from "@/components/app/topbar";

export default async function OrgLayout({
  children,
  params,
}: LayoutProps<"/o/[orgSlug]">) {
  const { orgSlug } = await params;
  const ctx = await loadOrgContext(orgSlug);

  const memberships = await db
    .select({
      id: schema.organization.id,
      name: schema.organization.name,
      slug: schema.organization.slug,
    })
    .from(schema.member)
    .innerJoin(
      schema.organization,
      eq(schema.member.organizationId, schema.organization.id),
    )
    .where(eq(schema.member.userId, ctx.session.user.id));

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Topbar
        currentOrg={ctx.organization}
        memberships={memberships}
        user={{
          name: ctx.session.user.name,
          email: ctx.session.user.email,
          image: ctx.session.user.image,
          isSuperAdmin: ctx.isSuperAdmin,
        }}
      />
      <main className="flex-1 px-4 py-8">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}

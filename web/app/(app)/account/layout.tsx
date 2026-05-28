import { eq } from "drizzle-orm";

import { requireSession } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";
import { AppShell } from "@/components/app/app-shell";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession("/sign-in?redirect=/account");

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
    .where(eq(schema.member.userId, session.user.id));

  const isSuperAdmin = session.user.role === "admin";

  return (
    <AppShell
      mode="account"
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        isSuperAdmin,
      }}
      teams={memberships}
      items={[]}
    >
      {children}
    </AppShell>
  );
}

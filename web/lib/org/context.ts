import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { requireSession } from "@/lib/auth/guards";
import type { OrgRole } from "@/lib/auth/permissions";
import { db } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";
import type { CurrentSession } from "@/lib/auth/session";

export type OrgContext = {
  session: CurrentSession;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  role: OrgRole;
  isSuperAdmin: boolean;
};

export async function loadOrgContext(orgSlug: string): Promise<OrgContext> {
  const session = await requireSession();
  const isSuperAdmin = session.user.role === "admin";

  const orgRow = await db
    .select({
      id: schema.organization.id,
      name: schema.organization.name,
      slug: schema.organization.slug,
    })
    .from(schema.organization)
    .where(eq(schema.organization.slug, orgSlug))
    .limit(1);

  const organization = orgRow[0];
  if (!organization) notFound();

  const memberRow = await db
    .select({ role: schema.member.role })
    .from(schema.member)
    .where(
      and(
        eq(schema.member.userId, session.user.id),
        eq(schema.member.organizationId, organization.id),
      ),
    )
    .limit(1);

  const rawRole = memberRow[0]?.role;
  let role: OrgRole | null = null;
  if (rawRole === "owner" || rawRole === "admin" || rawRole === "member") {
    role = rawRole;
  }

  if (!role && !isSuperAdmin) {
    redirect("/post-auth");
  }

  const activeId =
    (session.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null;

  if (role && activeId !== organization.id) {
    try {
      const headerList = await headers();
      await auth.api.setActiveOrganization({
        headers: headerList,
        body: { organizationId: organization.id },
      });
    } catch (err) {
      console.error("[org-context] no se pudo fijar org activa", err);
    }
  }

  return {
    session,
    organization,
    role: role ?? "member",
    isSuperAdmin,
  };
}

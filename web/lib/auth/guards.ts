import { notFound, redirect } from "next/navigation";

import { getSession, type CurrentSession } from "@/lib/auth/session";
import type { OrgRole } from "@/lib/auth/permissions";

export async function requireSession(redirectTo = "/sign-in"): Promise<CurrentSession> {
  const session = await getSession();
  if (!session) redirect(redirectTo);
  return session;
}

export async function requireSuperAdmin(): Promise<CurrentSession> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (session.user.role !== "admin") notFound();
  return session;
}

export type ActiveOrgContext = {
  session: CurrentSession;
  organizationId: string;
  role: OrgRole;
};

export async function requireActiveOrganization(): Promise<ActiveOrgContext> {
  const session = await requireSession();

  const activeOrganizationId =
    (session.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null;

  if (!activeOrganizationId) {
    redirect("/onboarding");
  }

  const role = await resolveMembershipRole(session.user.id, activeOrganizationId);

  if (!role) {
    redirect("/onboarding");
  }

  return { session, organizationId: activeOrganizationId, role };
}

export async function requireOrgRole(...allowed: OrgRole[]): Promise<ActiveOrgContext> {
  const ctx = await requireActiveOrganization();
  if (!allowed.includes(ctx.role)) notFound();
  return ctx;
}

async function resolveMembershipRole(
  userId: string,
  organizationId: string,
): Promise<OrgRole | null> {
  const { db } = await import("@/lib/db/client");
  const { schema } = await import("@/lib/db/schema");
  const { and, eq } = await import("drizzle-orm");

  const row = await db
    .select({ role: schema.member.role })
    .from(schema.member)
    .where(
      and(
        eq(schema.member.userId, userId),
        eq(schema.member.organizationId, organizationId),
      ),
    )
    .limit(1);

  const role = row[0]?.role;
  if (role === "owner" || role === "admin" || role === "member") {
    return role;
  }
  return null;
}

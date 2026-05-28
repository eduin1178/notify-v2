import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";
import type { CurrentSession } from "@/lib/auth/session";

export type PostAuthDestination =
  | { kind: "super-admin" }
  | { kind: "active-org"; slug: string }
  | { kind: "invitations" }
  | { kind: "onboarding-new-org" };

export async function resolvePostAuthDestination(
  session: CurrentSession,
): Promise<PostAuthDestination> {
  const userId = session.user.id;
  const email = session.user.email.trim().toLowerCase();
  const isSuperAdmin = session.user.role === "admin";

  const memberships = await db
    .select({
      organizationId: schema.member.organizationId,
      slug: schema.organization.slug,
    })
    .from(schema.member)
    .innerJoin(
      schema.organization,
      eq(schema.member.organizationId, schema.organization.id),
    )
    .where(eq(schema.member.userId, userId));

  const activeOrganizationId =
    (session.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null;

  if (memberships.length > 0) {
    const active = activeOrganizationId
      ? memberships.find((m) => m.organizationId === activeOrganizationId)
      : null;
    const target = active ?? memberships[0];
    return { kind: "active-org", slug: target.slug };
  }

  if (isSuperAdmin) {
    return { kind: "super-admin" };
  }

  const pendingInvitations = await db
    .select({ id: schema.invitation.id })
    .from(schema.invitation)
    .where(
      and(
        eq(schema.invitation.email, email),
        eq(schema.invitation.status, "pending"),
      ),
    )
    .limit(1);

  if (pendingInvitations.length > 0) {
    return { kind: "invitations" };
  }

  return { kind: "onboarding-new-org" };
}

export function destinationToPath(destination: PostAuthDestination): string {
  switch (destination.kind) {
    case "super-admin":
      return "/super-admin";
    case "active-org":
      return `/org/${destination.slug}`;
    case "invitations":
      return "/onboarding/invitations";
    case "onboarding-new-org":
      return "/onboarding/new-org";
  }
}

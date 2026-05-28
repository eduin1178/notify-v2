import type { Metadata } from "next";
import { and, eq, gt } from "drizzle-orm";

import { loadOrgContext } from "@/lib/org/context";
import { db } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { can } from "@/lib/auth/permissions";
import { MembersClient } from "@/components/app/members-client";

export const metadata: Metadata = {
  title: "Miembros · Notify",
};

export const dynamic = "force-dynamic";

export default async function MembersPage({
  params,
}: PageProps<"/org/[orgSlug]/members">) {
  const { orgSlug } = await params;
  const ctx = await loadOrgContext(orgSlug);

  const members = await db
    .select({
      memberId: schema.member.id,
      userId: schema.member.userId,
      role: schema.member.role,
      createdAt: schema.member.createdAt,
      name: schema.user.name,
      email: schema.user.email,
      image: schema.user.image,
    })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .where(eq(schema.member.organizationId, ctx.organization.id));

  const now = new Date();
  const pendingInvitations = await db
    .select({
      id: schema.invitation.id,
      email: schema.invitation.email,
      role: schema.invitation.role,
      expiresAt: schema.invitation.expiresAt,
    })
    .from(schema.invitation)
    .where(
      and(
        eq(schema.invitation.organizationId, ctx.organization.id),
        eq(schema.invitation.status, "pending"),
        gt(schema.invitation.expiresAt, now),
      ),
    );

  const actor = { isSuperAdmin: ctx.isSuperAdmin, orgRole: ctx.role };
  const canInvite = can(actor, "org.members.invite");
  const canDelete = can(actor, "org.delete");
  const canTransfer = can(actor, "org.transferOwnership");

  const baseInviteUrl = `${env.BETTER_AUTH_URL}/invitations`;

  return (
    <MembersClient
      orgSlug={ctx.organization.slug}
      orgName={ctx.organization.name}
      currentUserId={ctx.session.user.id}
      actorRole={ctx.role}
      isSuperAdmin={ctx.isSuperAdmin}
      canInvite={canInvite}
      canDelete={canDelete}
      canTransfer={canTransfer}
      members={members.map((m) => ({
        memberId: m.memberId,
        userId: m.userId,
        role: normalizeRole(m.role),
        name: m.name,
        email: m.email,
        image: m.image,
      }))}
      pendingInvitations={pendingInvitations.map((i) => ({
        id: i.id,
        email: i.email,
        role: normalizeRole(i.role),
        expiresAt: i.expiresAt.toISOString(),
        link: `${baseInviteUrl}/${i.id}`,
      }))}
    />
  );
}

function normalizeRole(role: string | null | undefined): "owner" | "admin" | "member" {
  if (role === "owner" || role === "admin" || role === "member") return role;
  return "member";
}

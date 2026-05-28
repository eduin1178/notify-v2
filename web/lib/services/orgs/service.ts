import { and, eq } from "drizzle-orm";

import { schema } from "@/lib/db/schema";
import type { ServiceContext } from "@/lib/services/context";
import { DomainErrors } from "@/lib/services/errors";
import type {
  MemberDtoT,
  MembersResponseT,
  OrganizationDtoT,
} from "@/lib/services/orgs/schemas";

async function ensureMembership(ctx: ServiceContext, orgId: string): Promise<void> {
  const memberRow = await ctx.db
    .select({ id: schema.member.id })
    .from(schema.member)
    .where(
      and(
        eq(schema.member.userId, ctx.currentUser.id),
        eq(schema.member.organizationId, orgId),
      ),
    )
    .limit(1);

  if (!memberRow[0]) {
    throw DomainErrors.forbidden("No eres miembro de esta organización.");
  }
}

async function loadOrg(ctx: ServiceContext, orgId: string) {
  const orgRow = await ctx.db
    .select({
      id: schema.organization.id,
      name: schema.organization.name,
      slug: schema.organization.slug,
      logo: schema.organization.logo,
      createdAt: schema.organization.createdAt,
    })
    .from(schema.organization)
    .where(eq(schema.organization.id, orgId))
    .limit(1);

  const org = orgRow[0];
  if (!org) {
    throw DomainErrors.notFound("Organización no encontrada.");
  }
  return org;
}

export async function getOrg(
  ctx: ServiceContext,
  orgId: string,
): Promise<OrganizationDtoT> {
  const org = await loadOrg(ctx, orgId);
  await ensureMembership(ctx, orgId);

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logo: org.logo,
    createdAt: org.createdAt.toISOString(),
  };
}

export async function listMembers(
  ctx: ServiceContext,
  orgId: string,
): Promise<MembersResponseT> {
  await loadOrg(ctx, orgId);
  await ensureMembership(ctx, orgId);

  const rows = await ctx.db
    .select({
      id: schema.member.id,
      userId: schema.member.userId,
      role: schema.member.role,
      createdAt: schema.member.createdAt,
      name: schema.user.name,
      email: schema.user.email,
      image: schema.user.image,
    })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
    .where(eq(schema.member.organizationId, orgId));

  const members: MemberDtoT[] = rows
    .map((row): MemberDtoT | null => {
      if (row.role !== "owner" && row.role !== "admin" && row.role !== "member") {
        return null;
      }
      return {
        id: row.id,
        userId: row.userId,
        role: row.role,
        name: row.name,
        email: row.email,
        image: row.image,
        createdAt: row.createdAt.toISOString(),
      };
    })
    .filter((m): m is MemberDtoT => m !== null);

  return { members };
}

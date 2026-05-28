import { eq } from "drizzle-orm";

import { schema } from "@/lib/db/schema";
import type { ServiceContext } from "@/lib/services/context";
import type { MeResponseT, OrganizationSummaryDtoT } from "@/lib/services/me/schemas";

export async function getMe(ctx: ServiceContext): Promise<MeResponseT> {
  const memberships = await ctx.db
    .select({
      id: schema.organization.id,
      name: schema.organization.name,
      slug: schema.organization.slug,
      role: schema.member.role,
    })
    .from(schema.member)
    .innerJoin(
      schema.organization,
      eq(schema.member.organizationId, schema.organization.id),
    )
    .where(eq(schema.member.userId, ctx.currentUser.id));

  const organizations: OrganizationSummaryDtoT[] = memberships
    .map((row): OrganizationSummaryDtoT | null => {
      if (row.role !== "owner" && row.role !== "admin" && row.role !== "member") {
        return null;
      }
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        role: row.role,
      };
    })
    .filter((m): m is OrganizationSummaryDtoT => m !== null);

  return {
    user: {
      id: ctx.currentUser.id,
      email: ctx.currentUser.email,
      name: ctx.currentUser.name,
      image: ctx.currentUser.image,
      role: ctx.currentUser.role,
    },
    organizations,
  };
}

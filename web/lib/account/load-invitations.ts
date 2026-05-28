import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";

export type InvitationSummary = {
  id: string;
  status: string;
  role: string | null;
  expiresAt: Date;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  inviter: {
    name: string;
    email: string;
  } | null;
};

export type AccountInvitations = {
  pending: InvitationSummary[];
  closed: InvitationSummary[];
};

const HISTORY_LIMIT = 20;

export async function loadAccountInvitations(
  email: string,
): Promise<AccountInvitations> {
  const rows = await db
    .select({
      id: schema.invitation.id,
      status: schema.invitation.status,
      role: schema.invitation.role,
      expiresAt: schema.invitation.expiresAt,
      organizationId: schema.organization.id,
      organizationName: schema.organization.name,
      organizationSlug: schema.organization.slug,
      inviterName: schema.user.name,
      inviterEmail: schema.user.email,
    })
    .from(schema.invitation)
    .innerJoin(
      schema.organization,
      eq(schema.invitation.organizationId, schema.organization.id),
    )
    .leftJoin(schema.user, eq(schema.invitation.inviterId, schema.user.id))
    .where(eq(schema.invitation.email, email))
    .orderBy(desc(schema.invitation.expiresAt));

  const pending: InvitationSummary[] = [];
  const closed: InvitationSummary[] = [];

  for (const row of rows) {
    const item: InvitationSummary = {
      id: row.id,
      status: row.status,
      role: row.role,
      expiresAt: row.expiresAt,
      organization: {
        id: row.organizationId,
        name: row.organizationName,
        slug: row.organizationSlug,
      },
      inviter: row.inviterName
        ? { name: row.inviterName, email: row.inviterEmail ?? "" }
        : null,
    };
    if (row.status === "pending") {
      pending.push(item);
    } else if (closed.length < HISTORY_LIMIT) {
      closed.push(item);
    }
  }

  return { pending, closed };
}

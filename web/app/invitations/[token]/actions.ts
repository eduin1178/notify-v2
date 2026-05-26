"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { requireSession } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";

type State = { error?: string };

export async function acceptInvitationByTokenAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  await requireSession();
  const token = String(formData.get("token") ?? "");
  if (!token) return { error: "Invitación inválida." };

  try {
    const headerList = await headers();
    await auth.api.acceptInvitation({
      headers: headerList,
      body: { invitationId: token },
    });
  } catch (err) {
    console.error("[accept-invitation-token] fallo", err);
    return { error: "No pudimos aceptar la invitación. Puede haber expirado." };
  }

  const inviteRow = await db
    .select({ organizationId: schema.invitation.organizationId })
    .from(schema.invitation)
    .where(eq(schema.invitation.id, token))
    .limit(1);

  if (!inviteRow[0]) redirect("/post-auth");

  const orgRow = await db
    .select({ slug: schema.organization.slug })
    .from(schema.organization)
    .where(eq(schema.organization.id, inviteRow[0].organizationId))
    .limit(1);

  if (!orgRow[0]) redirect("/post-auth");

  redirect(`/o/${orgRow[0].slug}`);
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { requireSession } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";

type State = { error?: string };

export async function acceptInvitationAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  await requireSession();

  const invitationId = String(formData.get("invitationId") ?? "").trim();
  if (!invitationId) {
    return { error: "Invitación inválida." };
  }

  try {
    const headerList = await headers();
    await auth.api.acceptInvitation({
      headers: headerList,
      body: { invitationId },
    });
  } catch (err) {
    console.error("[accept-invitation] fallo", err);
    return { error: "No pudimos aceptar la invitación. Puede haber expirado." };
  }

  const invitationRow = await db
    .select({ organizationId: schema.invitation.organizationId })
    .from(schema.invitation)
    .where(eq(schema.invitation.id, invitationId))
    .limit(1);

  const organizationId = invitationRow[0]?.organizationId;
  if (!organizationId) {
    redirect("/post-auth");
  }

  const orgRow = await db
    .select({ slug: schema.organization.slug })
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);

  const slug = orgRow[0]?.slug;
  if (!slug) {
    redirect("/post-auth");
  }

  redirect(`/org/${slug}`);
}

export async function rejectInvitationAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  await requireSession();

  const invitationId = String(formData.get("invitationId") ?? "").trim();
  if (!invitationId) {
    return { error: "Invitación inválida." };
  }

  try {
    const headerList = await headers();
    await auth.api.rejectInvitation({
      headers: headerList,
      body: { invitationId },
    });
  } catch (err) {
    console.error("[reject-invitation] fallo", err);
    return { error: "No pudimos rechazar la invitación." };
  }

  redirect("/onboarding/invitations");
}

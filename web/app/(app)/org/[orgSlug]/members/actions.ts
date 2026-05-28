"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { requireSession } from "@/lib/auth/guards";
import { can, type OrgRole } from "@/lib/auth/permissions";
import { db } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";

type State = { error?: string; ok?: boolean };

async function loadActor(orgSlug: string) {
  const session = await requireSession();
  const orgRow = await db
    .select({ id: schema.organization.id, slug: schema.organization.slug })
    .from(schema.organization)
    .where(eq(schema.organization.slug, orgSlug))
    .limit(1);
  const organization = orgRow[0];
  if (!organization) {
    return { error: "Organización no encontrada." } as const;
  }

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

  const raw = memberRow[0]?.role;
  const role: OrgRole | null =
    raw === "owner" || raw === "admin" || raw === "member" ? raw : null;
  const isSuperAdmin = session.user.role === "admin";

  if (!role && !isSuperAdmin) {
    return { error: "No tienes acceso a esta organización." } as const;
  }

  return {
    session,
    organization,
    role: role ?? "member",
    isSuperAdmin,
  } as const;
}

export async function inviteMemberAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const actor = await loadActor(orgSlug);
  if ("error" in actor) return { error: actor.error };

  if (
    !can(
      { isSuperAdmin: actor.isSuperAdmin, orgRole: actor.role },
      "org.members.invite",
    )
  ) {
    return { error: "No tienes permisos para invitar miembros." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "member");
  if (!email) return { error: "Ingresa un email." };
  if (role !== "admin" && role !== "member") {
    return { error: "Rol inválido." };
  }

  try {
    const headerList = await headers();
    await auth.api.createInvitation({
      headers: headerList,
      body: {
        email,
        role: role as "admin" | "member",
        organizationId: actor.organization.id,
        resend: true,
      },
    });
  } catch (err) {
    console.error("[invite-member] fallo", err);
    return { error: "No pudimos crear la invitación." };
  }

  revalidatePath(`/org/${orgSlug}/members`);
  return { ok: true };
}

export async function changeMemberRoleAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const actor = await loadActor(orgSlug);
  if ("error" in actor) return { error: actor.error };

  const memberId = String(formData.get("memberId") ?? "");
  const newRole = String(formData.get("role") ?? "");
  const targetCurrentRole = String(formData.get("currentRole") ?? "");

  if (!memberId || (newRole !== "owner" && newRole !== "admin" && newRole !== "member")) {
    return { error: "Datos inválidos." };
  }
  const currentRole: OrgRole =
    targetCurrentRole === "owner" || targetCurrentRole === "admin" ? targetCurrentRole : "member";

  if (
    !can(
      { isSuperAdmin: actor.isSuperAdmin, orgRole: actor.role },
      "org.members.changeRole",
      { kind: "member", role: currentRole },
    )
  ) {
    return { error: "No puedes cambiar este rol." };
  }

  try {
    const headerList = await headers();
    await auth.api.updateMemberRole({
      headers: headerList,
      body: {
        memberId,
        role: newRole as "owner" | "admin" | "member",
        organizationId: actor.organization.id,
      },
    });
  } catch (err) {
    console.error("[change-member-role] fallo", err);
    return { error: "No pudimos cambiar el rol." };
  }

  revalidatePath(`/org/${orgSlug}/members`);
  return { ok: true };
}

export async function removeMemberAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const actor = await loadActor(orgSlug);
  if ("error" in actor) return { error: actor.error };

  const memberId = String(formData.get("memberId") ?? "");
  const targetCurrentRole = String(formData.get("currentRole") ?? "");
  const currentRole: OrgRole =
    targetCurrentRole === "owner" || targetCurrentRole === "admin" ? targetCurrentRole : "member";

  if (
    !can(
      { isSuperAdmin: actor.isSuperAdmin, orgRole: actor.role },
      "org.members.remove",
      { kind: "member", role: currentRole },
    )
  ) {
    return { error: "No puedes remover a este miembro." };
  }

  try {
    const headerList = await headers();
    await auth.api.removeMember({
      headers: headerList,
      body: {
        memberIdOrEmail: memberId,
        organizationId: actor.organization.id,
      },
    });
  } catch (err) {
    console.error("[remove-member] fallo", err);
    return { error: "No pudimos remover al miembro." };
  }

  revalidatePath(`/org/${orgSlug}/members`);
  return { ok: true };
}

export async function transferOwnershipAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const actor = await loadActor(orgSlug);
  if ("error" in actor) return { error: actor.error };

  if (
    !can(
      { isSuperAdmin: actor.isSuperAdmin, orgRole: actor.role },
      "org.transferOwnership",
    )
  ) {
    return { error: "Solo el propietario puede transferir la organización." };
  }

  const newOwnerMemberId = String(formData.get("memberId") ?? "");
  if (!newOwnerMemberId) return { error: "Selecciona un miembro destino." };

  const targetMember = await db
    .select({ userId: schema.member.userId })
    .from(schema.member)
    .where(
      and(
        eq(schema.member.id, newOwnerMemberId),
        eq(schema.member.organizationId, actor.organization.id),
      ),
    )
    .limit(1);

  if (targetMember.length === 0) {
    return { error: "El miembro destino no existe en esta organización." };
  }

  if (targetMember[0].userId === actor.session.user.id) {
    return { error: "Ya eres el propietario." };
  }

  try {
    const headerList = await headers();

    await auth.api.updateMemberRole({
      headers: headerList,
      body: {
        memberId: newOwnerMemberId,
        role: "owner",
        organizationId: actor.organization.id,
      },
    });

    const selfMember = await db
      .select({ id: schema.member.id })
      .from(schema.member)
      .where(
        and(
          eq(schema.member.userId, actor.session.user.id),
          eq(schema.member.organizationId, actor.organization.id),
        ),
      )
      .limit(1);

    if (selfMember[0]) {
      await auth.api.updateMemberRole({
        headers: headerList,
        body: {
          memberId: selfMember[0].id,
          role: "admin",
          organizationId: actor.organization.id,
        },
      });
    }
  } catch (err) {
    console.error("[transfer-ownership] fallo", err);
    return {
      error:
        "No pudimos completar la transferencia. Verifica que el destinatario esté activo.",
    };
  }

  revalidatePath(`/org/${orgSlug}/members`);
  return { ok: true };
}

export async function deleteOrganizationAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const actor = await loadActor(orgSlug);
  if ("error" in actor) return { error: actor.error };

  if (
    !can({ isSuperAdmin: actor.isSuperAdmin, orgRole: actor.role }, "org.delete")
  ) {
    return { error: "Solo el propietario puede eliminar la organización." };
  }

  const confirmText = String(formData.get("confirm") ?? "").trim();
  if (confirmText !== orgSlug) {
    return { error: `Escribe "${orgSlug}" para confirmar.` };
  }

  try {
    const headerList = await headers();
    await auth.api.deleteOrganization({
      headers: headerList,
      body: { organizationId: actor.organization.id },
    });
  } catch (err) {
    console.error("[delete-org] fallo", err);
    return { error: "No pudimos eliminar la organización." };
  }

  redirect("/post-auth");
}

export async function cancelInvitationAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const actor = await loadActor(orgSlug);
  if ("error" in actor) return { error: actor.error };

  if (
    !can(
      { isSuperAdmin: actor.isSuperAdmin, orgRole: actor.role },
      "org.members.invite",
    )
  ) {
    return { error: "No tienes permisos." };
  }

  const invitationId = String(formData.get("invitationId") ?? "");
  if (!invitationId) return { error: "Invitación inválida." };

  try {
    const headerList = await headers();
    await auth.api.cancelInvitation({
      headers: headerList,
      body: { invitationId },
    });
  } catch (err) {
    console.error("[cancel-invitation] fallo", err);
    return { error: "No pudimos cancelar la invitación." };
  }

  revalidatePath(`/org/${orgSlug}/members`);
  return { ok: true };
}

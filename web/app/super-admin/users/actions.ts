"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/auth/guards";

type State = { error?: string; ok?: boolean };

const SUSPEND_REASON = "Acceso suspendido por la plataforma";

export async function suspendUserAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const actor = await requireSuperAdmin();

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Usuario inválido." };

  if (userId === actor.user.id) {
    return { error: "No puedes suspender tu propia cuenta." };
  }

  try {
    const headerList = await headers();
    await auth.api.banUser({
      headers: headerList,
      body: {
        userId,
        banReason: SUSPEND_REASON,
      },
    });
  } catch (err) {
    console.error("[suspend-user] fallo", err);
    return { error: "No pudimos suspender al usuario." };
  }

  revalidatePath("/super-admin/users");
  return { ok: true };
}

export async function reactivateUserAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  await requireSuperAdmin();

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Usuario inválido." };

  try {
    const headerList = await headers();
    await auth.api.unbanUser({
      headers: headerList,
      body: { userId },
    });
  } catch (err) {
    console.error("[reactivate-user] fallo", err);
    return { error: "No pudimos reactivar al usuario." };
  }

  revalidatePath("/super-admin/users");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { buildServerTenantServiceContext } from "@/lib/api/server-ctx";
import { loadOrgContext } from "@/lib/org/context";
import { isDomainError } from "@/lib/services/errors";
import {
  connectWhatsApp,
  disconnect,
  reconnect,
} from "@/lib/services/whatsapp/service";

type State = { error?: string };

function errorMessage(err: unknown): string {
  if (isDomainError(err)) return err.message;
  console.error("[whatsapp-action] fallo", err);
  return "Ocurrió un error al procesar la solicitud. Intenta de nuevo.";
}

/** Genera el setup link y redirige al onboarding de Kapso. */
export async function connectWhatsappAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  let url: string;
  try {
    const ctx = await loadOrgContext(orgSlug);
    const svc = await buildServerTenantServiceContext(ctx.organization.id);
    const res = await connectWhatsApp(svc);
    url = res.url;
  } catch (err) {
    return { error: errorMessage(err) };
  }
  redirect(url);
}

export async function disconnectWhatsappAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const connectionId = String(formData.get("connectionId") ?? "");
  try {
    const ctx = await loadOrgContext(orgSlug);
    const svc = await buildServerTenantServiceContext(ctx.organization.id);
    await disconnect(svc, connectionId);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/org/${orgSlug}/whatsapp`);
  return {};
}

/** Genera un setup link de reconexión y redirige al onboarding de Kapso. */
export async function reconnectWhatsappAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const connectionId = String(formData.get("connectionId") ?? "");
  let url: string;
  try {
    const ctx = await loadOrgContext(orgSlug);
    const svc = await buildServerTenantServiceContext(ctx.organization.id);
    const res = await reconnect(svc, connectionId);
    url = res.url;
  } catch (err) {
    return { error: errorMessage(err) };
  }
  redirect(url);
}

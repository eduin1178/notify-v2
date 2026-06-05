"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { buildServerTenantServiceContext } from "@/lib/api/server-ctx";
import { loadOrgContext } from "@/lib/org/context";
import { isDomainError } from "@/lib/services/errors";
import type { ImportablePhoneNumberDtoT } from "@/lib/services/whatsapp/schemas";
import {
  connectWhatsApp,
  disconnect,
  importPhoneNumber,
  listImportablePhoneNumbers,
  reconnect,
  renameConnection,
} from "@/lib/services/whatsapp/service";

type State = { error?: string };
type ImportState = { error?: string; success?: boolean };
type ImportListState =
  | { ok: true; numbers: ImportablePhoneNumberDtoT[] }
  | { ok: false; error: string };

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

/** Lista los números de Kapso aún no agregados a Notify (al abrir el diálogo). */
export async function listImportableNumbersAction(
  orgSlug: string,
): Promise<ImportListState> {
  try {
    const ctx = await loadOrgContext(orgSlug);
    const svc = await buildServerTenantServiceContext(ctx.organization.id);
    const { numbers } = await listImportablePhoneNumbers(svc);
    return { ok: true, numbers };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Importa un número existente de Kapso y refresca la lista de conexiones. */
export async function importWhatsappNumberAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const phoneNumberId = String(formData.get("phoneNumberId") ?? "");
  if (!phoneNumberId) {
    return { error: "Selecciona un número para importar." };
  }
  try {
    const ctx = await loadOrgContext(orgSlug);
    const svc = await buildServerTenantServiceContext(ctx.organization.id);
    await importPhoneNumber(svc, phoneNumberId);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/org/${orgSlug}/whatsapp`);
  return { success: true };
}

/** Renombra una conexión (etiqueta editable) y refresca la lista. */
export async function renameWhatsappConnectionAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const connectionId = String(formData.get("connectionId") ?? "");
  const name = String(formData.get("name") ?? "");
  if (!name.trim()) {
    return { error: "El nombre no puede estar vacío." };
  }
  try {
    const ctx = await loadOrgContext(orgSlug);
    const svc = await buildServerTenantServiceContext(ctx.organization.id);
    await renameConnection(svc, connectionId, name);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/org/${orgSlug}/whatsapp`);
  return { success: true };
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

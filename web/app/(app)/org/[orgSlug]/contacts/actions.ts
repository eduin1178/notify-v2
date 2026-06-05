"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { buildServerTenantServiceContext } from "@/lib/api/server-ctx";
import { loadOrgContext } from "@/lib/org/context";
import {
  CreateContactInput,
  CreateTagInput,
  UpdateContactInput,
} from "@/lib/services/contacts/schemas";
import {
  createContact,
  createTag,
  deleteContact,
  deleteTag,
  exportContactsCsv,
  importContactsCsv,
  importContactsFromWhatsApp,
  setContactTags,
  updateContact,
} from "@/lib/services/contacts/service";
import type {
  ImportCsvReportT,
  WhatsappImportReportT,
} from "@/lib/services/contacts/schemas";
import { isDomainError } from "@/lib/services/errors";
import { listConnections } from "@/lib/services/whatsapp/service";

export type ContactFormState = {
  ok?: boolean;
  contactId?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export type TagActionState = {
  ok?: boolean;
  error?: string;
};

function fieldErrorsFrom(err: ZodError): Record<string, string> {
  const flat = err.flatten().fieldErrors;
  const result: Record<string, string> = {};
  for (const [key, messages] of Object.entries(flat)) {
    if (messages && messages.length > 0) result[key] = messages[0];
  }
  return result;
}

function errorMessage(err: unknown): string {
  if (isDomainError(err)) return err.message;
  console.error("[contacts-action] fallo", err);
  return "Ocurrió un error al procesar la solicitud. Intenta de nuevo.";
}

export async function createContactAction(
  orgSlug: string,
  input: unknown,
): Promise<ContactFormState> {
  const parsed = CreateContactInput.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  let contactId: string;
  try {
    const ctx = await loadOrgContext(orgSlug);
    const svc = await buildServerTenantServiceContext(ctx.organization.id);
    const created = await createContact(svc, parsed.data);
    contactId = created.id;
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/org/${orgSlug}/contacts`);
  return { ok: true, contactId };
}

export async function updateContactAction(
  orgSlug: string,
  id: string,
  input: unknown,
): Promise<ContactFormState> {
  const parsed = UpdateContactInput.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  try {
    const ctx = await loadOrgContext(orgSlug);
    const svc = await buildServerTenantServiceContext(ctx.organization.id);
    await updateContact(svc, id, parsed.data);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/org/${orgSlug}/contacts`);
  return { ok: true };
}

export async function deleteContactAction(
  orgSlug: string,
  id: string,
): Promise<ContactFormState> {
  try {
    const ctx = await loadOrgContext(orgSlug);
    const svc = await buildServerTenantServiceContext(ctx.organization.id);
    await deleteContact(svc, id);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/org/${orgSlug}/contacts`);
  return { ok: true };
}

/** Reemplaza las etiquetas de un contacto. */
export async function setContactTagsAction(
  orgSlug: string,
  contactId: string,
  tagIds: string[],
): Promise<ContactFormState> {
  try {
    const ctx = await loadOrgContext(orgSlug);
    const svc = await buildServerTenantServiceContext(ctx.organization.id);
    await setContactTags(svc, contactId, tagIds);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/org/${orgSlug}/contacts`);
  return { ok: true };
}

export type ExportCsvState =
  | { ok: true; csv: string }
  | { ok: false; error: string };

export async function exportContactsCsvAction(
  orgSlug: string,
): Promise<ExportCsvState> {
  try {
    const ctx = await loadOrgContext(orgSlug);
    const svc = await buildServerTenantServiceContext(ctx.organization.id);
    const csv = await exportContactsCsv(svc);
    return { ok: true, csv };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export type ImportCsvState =
  | { ok: true; report: ImportCsvReportT }
  | { ok: false; error: string };

export async function importContactsCsvAction(
  orgSlug: string,
  csvText: string,
): Promise<ImportCsvState> {
  try {
    const ctx = await loadOrgContext(orgSlug);
    const svc = await buildServerTenantServiceContext(ctx.organization.id);
    const report = await importContactsCsv(svc, csvText);
    revalidatePath(`/org/${orgSlug}/contacts`);
    return { ok: true, report };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export type ConnectedNumber = { id: string; label: string };

export type ListConnectedState =
  | { ok: true; connections: ConnectedNumber[] }
  | { ok: false; error: string };

/** Conexiones de WhatsApp `connected` de la org (para elegir desde dónde importar). */
export async function listConnectedWhatsappAction(
  orgSlug: string,
): Promise<ListConnectedState> {
  try {
    const ctx = await loadOrgContext(orgSlug);
    const svc = await buildServerTenantServiceContext(ctx.organization.id);
    const { connections } = await listConnections(svc);
    const connected = connections
      .filter((conn) => conn.status === "connected")
      .map((conn) => ({
        id: conn.id,
        label:
          conn.name ?? conn.displayPhoneNumber ?? conn.phoneNumberId ?? conn.id,
      }));
    return { ok: true, connections: connected };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export type WhatsappImportState =
  | { ok: true; report: WhatsappImportReportT }
  | { ok: false; error: string };

export async function importFromWhatsappAction(
  orgSlug: string,
  connectionId: string,
): Promise<WhatsappImportState> {
  try {
    const ctx = await loadOrgContext(orgSlug);
    const svc = await buildServerTenantServiceContext(ctx.organization.id);
    const report = await importContactsFromWhatsApp(svc, connectionId);
    revalidatePath(`/org/${orgSlug}/contacts`);
    return { ok: true, report };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function createTagAction(
  orgSlug: string,
  name: string,
): Promise<TagActionState> {
  const parsed = CreateTagInput.safeParse({ name });
  if (!parsed.success) {
    return { error: fieldErrorsFrom(parsed.error).name ?? "Nombre inválido." };
  }
  try {
    const ctx = await loadOrgContext(orgSlug);
    const svc = await buildServerTenantServiceContext(ctx.organization.id);
    await createTag(svc, parsed.data.name);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/org/${orgSlug}/contacts`);
  return { ok: true };
}

export async function deleteTagAction(
  orgSlug: string,
  tagId: string,
): Promise<TagActionState> {
  try {
    const ctx = await loadOrgContext(orgSlug);
    const svc = await buildServerTenantServiceContext(ctx.organization.id);
    await deleteTag(svc, tagId);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/org/${orgSlug}/contacts`);
  return { ok: true };
}

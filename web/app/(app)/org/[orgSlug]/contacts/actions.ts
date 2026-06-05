"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { buildServerTenantServiceContext } from "@/lib/api/server-ctx";
import { loadOrgContext } from "@/lib/org/context";
import {
  CreateContactInput,
  UpdateContactInput,
} from "@/lib/services/contacts/schemas";
import {
  createContact,
  deleteContact,
  updateContact,
} from "@/lib/services/contacts/service";
import { isDomainError } from "@/lib/services/errors";

export type ContactFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
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
  try {
    const ctx = await loadOrgContext(orgSlug);
    const svc = await buildServerTenantServiceContext(ctx.organization.id);
    await createContact(svc, parsed.data);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath(`/org/${orgSlug}/contacts`);
  return { ok: true };
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

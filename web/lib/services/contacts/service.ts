/**
 * Lógica de dominio de los contactos.
 *
 * Módulo puro: NO importa `next/*`, `hono`, `@hono/*` ni `web/app/**`.
 * Todo lo de la organización/usuario entra por `ctx`. Las queries SIEMPRE
 * filtran por `ctx.currentOrg.id` (aislamiento multi-tenant estricto).
 *
 * Autorización: por membresía (la verifica el adaptador con `requireOrgMembership`).
 * No hay distinción de rol en este alcance — los contactos son datos operativos.
 */

import { and, desc, eq, sql } from "drizzle-orm";

import { schema } from "@/lib/db/schema";
import type { TenantServiceContext } from "@/lib/services/context";
import { DomainErrors } from "@/lib/services/errors";
import { normalizePhone } from "@/lib/services/contacts/phone";
import type {
  ContactDtoT,
  CreateContactInputT,
  ListContactsQueryT,
  PaginatedContactsResponseT,
  UpdateContactInputT,
} from "@/lib/services/contacts/schemas";

type ContactRow = typeof schema.contact.$inferSelect;

function toDto(row: ContactRow): ContactDtoT {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    email: row.email,
    address: row.address,
    city: row.city,
    company: row.company,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Normaliza un texto opcional: vacío o ausente → `null`. */
function cleanOptional(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function requirePhone(raw: string): string {
  const e164 = normalizePhone(raw);
  if (!e164) {
    throw DomainErrors.validation(
      "Ingresa un teléfono válido en formato internacional, por ejemplo +573001234567.",
    );
  }
  return e164;
}

async function assertPhoneUnique(
  ctx: TenantServiceContext,
  phone: string,
  excludeId?: string,
): Promise<void> {
  const rows = await ctx.db
    .select({ id: schema.contact.id })
    .from(schema.contact)
    .where(
      and(
        eq(schema.contact.organizationId, ctx.currentOrg.id),
        eq(schema.contact.phone, phone),
      ),
    )
    .limit(1);

  const existing = rows[0];
  if (existing && existing.id !== excludeId) {
    throw DomainErrors.conflict("Ya existe un contacto con este teléfono.");
  }
}

async function loadOwned(
  ctx: TenantServiceContext,
  id: string,
): Promise<ContactRow> {
  const rows = await ctx.db
    .select()
    .from(schema.contact)
    .where(
      and(
        eq(schema.contact.id, id),
        eq(schema.contact.organizationId, ctx.currentOrg.id),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw DomainErrors.notFound("Contacto no encontrado.");
  }
  return row;
}

/** Conteo total de contactos de la organización (card del dashboard). */
export async function countContacts(ctx: TenantServiceContext): Promise<number> {
  const rows = await ctx.db
    .select({ value: sql<number>`count(*)` })
    .from(schema.contact)
    .where(eq(schema.contact.organizationId, ctx.currentOrg.id));
  return Number(rows[0]?.value ?? 0);
}

/** Listado paginado por offset con metadatos de paginación. */
export async function listContacts(
  ctx: TenantServiceContext,
  query: ListContactsQueryT,
): Promise<PaginatedContactsResponseT> {
  const { page, pageSize } = query;
  const orgFilter = eq(schema.contact.organizationId, ctx.currentOrg.id);

  const totalRows = await ctx.db
    .select({ value: sql<number>`count(*)` })
    .from(schema.contact)
    .where(orgFilter);
  const total = Number(totalRows[0]?.value ?? 0);
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  const rows = await ctx.db
    .select()
    .from(schema.contact)
    .where(orgFilter)
    .orderBy(desc(schema.contact.createdAt), desc(schema.contact.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    items: rows.map(toDto),
    page,
    pageSize,
    total,
    totalPages,
  };
}

export async function getContact(
  ctx: TenantServiceContext,
  id: string,
): Promise<ContactDtoT> {
  return toDto(await loadOwned(ctx, id));
}

export async function createContact(
  ctx: TenantServiceContext,
  input: CreateContactInputT,
): Promise<ContactDtoT> {
  const phone = requirePhone(input.phone);
  await assertPhoneUnique(ctx, phone);

  const now = new Date();
  const row: ContactRow = {
    id: crypto.randomUUID(),
    organizationId: ctx.currentOrg.id,
    firstName: input.firstName.trim(),
    lastName: cleanOptional(input.lastName),
    phone,
    email: cleanOptional(input.email),
    address: cleanOptional(input.address),
    city: cleanOptional(input.city),
    company: cleanOptional(input.company),
    source: "manual",
    createdAt: now,
    updatedAt: now,
  };

  await ctx.db.insert(schema.contact).values(row);
  return toDto(row);
}

export async function updateContact(
  ctx: TenantServiceContext,
  id: string,
  input: UpdateContactInputT,
): Promise<ContactDtoT> {
  await loadOwned(ctx, id);
  const phone = requirePhone(input.phone);
  await assertPhoneUnique(ctx, phone, id);

  await ctx.db
    .update(schema.contact)
    .set({
      firstName: input.firstName.trim(),
      lastName: cleanOptional(input.lastName),
      phone,
      email: cleanOptional(input.email),
      address: cleanOptional(input.address),
      city: cleanOptional(input.city),
      company: cleanOptional(input.company),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.contact.id, id),
        eq(schema.contact.organizationId, ctx.currentOrg.id),
      ),
    );

  return toDto(await loadOwned(ctx, id));
}

export async function deleteContact(
  ctx: TenantServiceContext,
  id: string,
): Promise<void> {
  await loadOwned(ctx, id);
  await ctx.db
    .delete(schema.contact)
    .where(
      and(
        eq(schema.contact.id, id),
        eq(schema.contact.organizationId, ctx.currentOrg.id),
      ),
    );
}

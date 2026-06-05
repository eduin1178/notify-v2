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

import { and, desc, eq, exists, inArray, sql } from "drizzle-orm";

import { schema } from "@/lib/db/schema";
import { listWhatsappContacts } from "@/lib/integrations/kapso/client";
import type { TenantServiceContext } from "@/lib/services/context";
import { DomainErrors } from "@/lib/services/errors";
import {
  isEmptyRow,
  normalizeHeader,
  parseCsv,
  toCsv,
} from "@/lib/services/contacts/csv";
import { normalizePhone } from "@/lib/services/contacts/phone";
import type {
  ContactDtoT,
  CreateContactInputT,
  ImportCsvReportT,
  ImportInvalidRowT,
  ListContactsQueryT,
  PaginatedContactsResponseT,
  TagDtoT,
  UpdateContactInputT,
  WhatsappImportReportT,
} from "@/lib/services/contacts/schemas";

type ContactRow = typeof schema.contact.$inferSelect;

function toDto(row: ContactRow, tags: TagDtoT[]): ContactDtoT {
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
    tags,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Carga las etiquetas de un conjunto de contactos, agrupadas por contactId. */
async function loadTagsByContact(
  ctx: TenantServiceContext,
  contactIds: string[],
): Promise<Map<string, TagDtoT[]>> {
  const map = new Map<string, TagDtoT[]>();
  if (contactIds.length === 0) return map;

  const rows = await ctx.db
    .select({
      contactId: schema.contactTag.contactId,
      id: schema.tag.id,
      name: schema.tag.name,
    })
    .from(schema.contactTag)
    .innerJoin(schema.tag, eq(schema.contactTag.tagId, schema.tag.id))
    .where(inArray(schema.contactTag.contactId, contactIds))
    .orderBy(schema.tag.name);

  for (const row of rows) {
    const list = map.get(row.contactId) ?? [];
    list.push({ id: row.id, name: row.name });
    map.set(row.contactId, list);
  }
  return map;
}

/** Etiquetas de un único contacto (orden alfabético). */
async function loadTagsForContact(
  ctx: TenantServiceContext,
  contactId: string,
): Promise<TagDtoT[]> {
  return (await loadTagsByContact(ctx, [contactId])).get(contactId) ?? [];
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

/** Listado paginado por offset con metadatos de paginación y filtro por etiqueta. */
export async function listContacts(
  ctx: TenantServiceContext,
  query: ListContactsQueryT,
): Promise<PaginatedContactsResponseT> {
  const { page, pageSize, tagId } = query;

  const conditions = [eq(schema.contact.organizationId, ctx.currentOrg.id)];
  if (tagId) {
    // Solo contactos que tienen la etiqueta indicada. La etiqueta es org-scoped;
    // un tagId ajeno no produce coincidencias (sus asignaciones apuntan a otra org).
    conditions.push(
      exists(
        ctx.db
          .select({ one: sql`1` })
          .from(schema.contactTag)
          .where(
            and(
              eq(schema.contactTag.contactId, schema.contact.id),
              eq(schema.contactTag.tagId, tagId),
            ),
          ),
      ),
    );
  }
  const whereClause = and(...conditions);

  const totalRows = await ctx.db
    .select({ value: sql<number>`count(*)` })
    .from(schema.contact)
    .where(whereClause);
  const total = Number(totalRows[0]?.value ?? 0);
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  const rows = await ctx.db
    .select()
    .from(schema.contact)
    .where(whereClause)
    .orderBy(desc(schema.contact.createdAt), desc(schema.contact.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const tagsByContact = await loadTagsByContact(
    ctx,
    rows.map((r) => r.id),
  );

  return {
    items: rows.map((r) => toDto(r, tagsByContact.get(r.id) ?? [])),
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
  const row = await loadOwned(ctx, id);
  return toDto(row, await loadTagsForContact(ctx, id));
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
  return toDto(row, []);
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

  const updated = await loadOwned(ctx, id);
  return toDto(updated, await loadTagsForContact(ctx, id));
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

// ── Import / Export CSV ──────────────────────────────────────────────────────

type CsvField =
  | "firstName"
  | "lastName"
  | "phone"
  | "email"
  | "address"
  | "city"
  | "company";

/** Cabeceras del CSV de exportación (y aceptadas en importación). */
const CSV_HEADERS = [
  "nombres",
  "apellidos",
  "telefono",
  "email",
  "direccion",
  "ciudad",
  "empresa",
] as const;

/** Mapeo de cabecera normalizada → campo del contacto. */
const HEADER_TO_FIELD: Record<string, CsvField> = {
  nombres: "firstName",
  nombre: "firstName",
  apellidos: "lastName",
  apellido: "lastName",
  telefono: "phone",
  email: "email",
  correo: "email",
  direccion: "address",
  ciudad: "city",
  empresa: "company",
};

/** Exporta todos los contactos de la organización a un texto CSV. */
export async function exportContactsCsv(
  ctx: TenantServiceContext,
): Promise<string> {
  const rows = await ctx.db
    .select()
    .from(schema.contact)
    .where(eq(schema.contact.organizationId, ctx.currentOrg.id))
    .orderBy(desc(schema.contact.createdAt), desc(schema.contact.id));

  const data = rows.map((r) => [
    r.firstName,
    r.lastName ?? "",
    r.phone,
    r.email ?? "",
    r.address ?? "",
    r.city ?? "",
    r.company ?? "",
  ]);

  return toCsv([...CSV_HEADERS], data);
}

/**
 * Importa contactos desde un CSV. Normaliza teléfonos a E.164, deduplica por
 * `(org, phone)` con política de OMITIR (nunca sobrescribe) y reporta filas
 * inválidas sin detener el lote. Los nuevos contactos quedan con `source="csv"`.
 */
export async function importContactsCsv(
  ctx: TenantServiceContext,
  csvText: string,
): Promise<ImportCsvReportT> {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    throw DomainErrors.validation("El archivo CSV está vacío.");
  }

  const header = rows[0];
  const colIndex: Partial<Record<CsvField, number>> = {};
  header.forEach((cell, idx) => {
    const field = HEADER_TO_FIELD[normalizeHeader(cell)];
    if (field && colIndex[field] === undefined) {
      colIndex[field] = idx;
    }
  });

  if (colIndex.firstName === undefined || colIndex.phone === undefined) {
    throw DomainErrors.validation(
      "El CSV debe incluir al menos las columnas 'nombres' y 'telefono'.",
    );
  }

  const existing = await ctx.db
    .select({ phone: schema.contact.phone })
    .from(schema.contact)
    .where(eq(schema.contact.organizationId, ctx.currentOrg.id));
  const seen = new Set(existing.map((r) => r.phone));

  const invalid: ImportInvalidRowT[] = [];
  const toInsert: (typeof schema.contact.$inferInsert)[] = [];
  let skippedDuplicate = 0;
  const now = new Date();

  const cellOf = (row: string[], field: CsvField): string => {
    const idx = colIndex[field];
    if (idx === undefined) return "";
    return (row[idx] ?? "").trim();
  };

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (isEmptyRow(row)) continue;

    const lineNumber = i + 1;
    const firstName = cellOf(row, "firstName");
    const rawPhone = cellOf(row, "phone");

    if (!firstName) {
      invalid.push({ row: lineNumber, reason: "Falta el nombre." });
      continue;
    }
    if (!rawPhone) {
      invalid.push({ row: lineNumber, reason: "Falta el teléfono." });
      continue;
    }
    const phone = normalizePhone(rawPhone);
    if (!phone) {
      invalid.push({
        row: lineNumber,
        reason: "Teléfono inválido (usa formato internacional, p. ej. +57...).",
      });
      continue;
    }
    if (seen.has(phone)) {
      skippedDuplicate++;
      continue;
    }

    seen.add(phone);
    toInsert.push({
      id: crypto.randomUUID(),
      organizationId: ctx.currentOrg.id,
      firstName,
      lastName: cleanOptional(cellOf(row, "lastName")),
      phone,
      email: cleanOptional(cellOf(row, "email")),
      address: cleanOptional(cellOf(row, "address")),
      city: cleanOptional(cellOf(row, "city")),
      company: cleanOptional(cellOf(row, "company")),
      source: "csv",
      createdAt: now,
      updatedAt: now,
    });
  }

  const CHUNK = 500;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    await ctx.db.insert(schema.contact).values(toInsert.slice(i, i + CHUNK));
  }

  return { imported: toInsert.length, skippedDuplicate, invalid };
}

// ── Etiquetas ────────────────────────────────────────────────────────────────

/** Listado de etiquetas de la organización (orden alfabético). */
export async function listTags(ctx: TenantServiceContext): Promise<TagDtoT[]> {
  const rows = await ctx.db
    .select({ id: schema.tag.id, name: schema.tag.name })
    .from(schema.tag)
    .where(eq(schema.tag.organizationId, ctx.currentOrg.id))
    .orderBy(schema.tag.name);
  return rows;
}

export async function createTag(
  ctx: TenantServiceContext,
  name: string,
): Promise<TagDtoT> {
  const trimmed = name.trim();
  const existing = await ctx.db
    .select({ id: schema.tag.id })
    .from(schema.tag)
    .where(
      and(
        eq(schema.tag.organizationId, ctx.currentOrg.id),
        eq(schema.tag.name, trimmed),
      ),
    )
    .limit(1);
  if (existing[0]) {
    throw DomainErrors.conflict("Ya existe una etiqueta con ese nombre.");
  }

  const now = new Date();
  const id = crypto.randomUUID();
  await ctx.db.insert(schema.tag).values({
    id,
    organizationId: ctx.currentOrg.id,
    name: trimmed,
    createdAt: now,
    updatedAt: now,
  });
  return { id, name: trimmed };
}

export async function deleteTag(
  ctx: TenantServiceContext,
  tagId: string,
): Promise<void> {
  const rows = await ctx.db
    .select({ id: schema.tag.id })
    .from(schema.tag)
    .where(
      and(
        eq(schema.tag.id, tagId),
        eq(schema.tag.organizationId, ctx.currentOrg.id),
      ),
    )
    .limit(1);
  if (!rows[0]) {
    throw DomainErrors.notFound("Etiqueta no encontrada.");
  }
  // Las asignaciones en contact_tag se eliminan por FK cascade.
  await ctx.db
    .delete(schema.tag)
    .where(
      and(
        eq(schema.tag.id, tagId),
        eq(schema.tag.organizationId, ctx.currentOrg.id),
      ),
    );
}

/**
 * Reemplaza el conjunto de etiquetas de un contacto por `tagIds`. Valida que el
 * contacto y todas las etiquetas pertenecen a la organización.
 */
export async function setContactTags(
  ctx: TenantServiceContext,
  contactId: string,
  tagIds: string[],
): Promise<ContactDtoT> {
  const contact = await loadOwned(ctx, contactId);

  const uniqueTagIds = [...new Set(tagIds)];
  if (uniqueTagIds.length > 0) {
    const owned = await ctx.db
      .select({ id: schema.tag.id })
      .from(schema.tag)
      .where(
        and(
          eq(schema.tag.organizationId, ctx.currentOrg.id),
          inArray(schema.tag.id, uniqueTagIds),
        ),
      );
    if (owned.length !== uniqueTagIds.length) {
      throw DomainErrors.notFound("Alguna etiqueta no existe en la organización.");
    }
  }

  await ctx.db
    .delete(schema.contactTag)
    .where(eq(schema.contactTag.contactId, contactId));

  if (uniqueTagIds.length > 0) {
    await ctx.db
      .insert(schema.contactTag)
      .values(uniqueTagIds.map((tagId) => ({ contactId, tagId })));
  }

  return toDto(contact, await loadTagsForContact(ctx, contactId));
}

// ── Import desde WhatsApp (Kapso) ────────────────────────────────────────────

/** Antepone `+` al wa_id si falta, para normalizar a E.164. */
function waIdToPhone(waId: string): string | null {
  const candidate = waId.startsWith("+") ? waId : `+${waId}`;
  return normalizePhone(candidate);
}

/**
 * Importa contactos desde WhatsApp a través de Kapso, SIEMPRE acotado al
 * `phone_number_id` de la conexión indicada. Valida que la conexión pertenece a
 * la organización y está `connected`. Mapea `wa_id → phone`,
 * `profile_name → first_name`. Omite contactos sin `wa_id` y deduplica por
 * `(org, phone)`. Recorre todas las páginas por cursor.
 */
export async function importContactsFromWhatsApp(
  ctx: TenantServiceContext,
  connectionId: string,
): Promise<WhatsappImportReportT> {
  const rows = await ctx.db
    .select({
      id: schema.whatsappConnection.id,
      status: schema.whatsappConnection.status,
      phoneNumberId: schema.whatsappConnection.phoneNumberId,
    })
    .from(schema.whatsappConnection)
    .where(
      and(
        eq(schema.whatsappConnection.id, connectionId),
        eq(schema.whatsappConnection.organizationId, ctx.currentOrg.id),
      ),
    )
    .limit(1);

  const connection = rows[0];
  if (!connection) {
    throw DomainErrors.notFound("Conexión de WhatsApp no encontrada.");
  }
  if (connection.status !== "connected") {
    throw DomainErrors.conflict(
      "La conexión debe estar conectada para importar contactos.",
    );
  }
  if (!connection.phoneNumberId) {
    throw DomainErrors.conflict("La conexión no tiene un número asociado.");
  }
  const phoneNumberId = connection.phoneNumberId;

  const existing = await ctx.db
    .select({ phone: schema.contact.phone })
    .from(schema.contact)
    .where(eq(schema.contact.organizationId, ctx.currentOrg.id));
  const seen = new Set(existing.map((r) => r.phone));

  const toInsert: (typeof schema.contact.$inferInsert)[] = [];
  let skippedNoPhone = 0;
  let skippedDuplicate = 0;
  const now = new Date();

  let after: string | undefined;
  const visitedCursors = new Set<string>();
  // Tope duro de seguridad para evitar bucles si Kapso devolviera cursores cíclicos.
  for (let guard = 0; guard < 1000; guard++) {
    const page = await listWhatsappContacts(phoneNumberId, {
      after,
      limit: 100,
    });

    for (const remote of page.contacts) {
      if (!remote.waId) {
        skippedNoPhone++;
        continue;
      }
      const phone = waIdToPhone(remote.waId);
      if (!phone) {
        skippedNoPhone++;
        continue;
      }
      if (seen.has(phone)) {
        skippedDuplicate++;
        continue;
      }
      seen.add(phone);

      const firstName =
        remote.profileName?.trim() || remote.displayName?.trim() || phone;
      toInsert.push({
        id: crypto.randomUUID(),
        organizationId: ctx.currentOrg.id,
        firstName,
        lastName: null,
        phone,
        email: null,
        address: null,
        city: null,
        company: null,
        source: "whatsapp",
        createdAt: now,
        updatedAt: now,
      });
    }

    if (!page.nextCursor || visitedCursors.has(page.nextCursor)) break;
    visitedCursors.add(page.nextCursor);
    after = page.nextCursor;
  }

  const CHUNK = 500;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    await ctx.db.insert(schema.contact).values(toInsert.slice(i, i + CHUNK));
  }

  return { imported: toInsert.length, skippedNoPhone, skippedDuplicate };
}

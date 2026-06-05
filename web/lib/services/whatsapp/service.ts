/**
 * Lógica de dominio de las conexiones de WhatsApp (vía Kapso).
 *
 * Módulo puro: NO importa `next/*`, `hono`, `@hono/*` ni `web/app/**`.
 * Todo lo de la organización/usuario entra por `ctx`. El cliente Kapso es un
 * adaptador de plataforma (singleton con API key global), no estado por-org.
 *
 * Autorización owner/admin: se evalúa AQUÍ con `can(...)`, no en el middleware.
 */

import { and, desc, eq, inArray } from "drizzle-orm";

import { can, type OrgRole } from "@/lib/auth/permissions";
import type { db as DbClient } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";
import { env } from "@/lib/env";
import {
  createCustomer,
  createSetupLink,
  deletePhoneNumber,
  getPhoneNumber,
  KapsoApiError,
  listPhoneNumbers,
  type KapsoConnectionType,
  type KapsoPhoneNumber,
  type KapsoSetupLink,
} from "@/lib/integrations/kapso/client";
import type { TenantServiceContext } from "@/lib/services/context";
import { DomainErrors } from "@/lib/services/errors";
import type { Logger } from "@/lib/services/logger";
import type {
  ImportablePhoneNumbersResponseT,
  SetupLinkResponseT,
  WhatsappConnectionDtoT,
  WhatsappConnectionsResponseT,
  WhatsappConnectionStatusT,
} from "@/lib/services/whatsapp/schemas";

type Db = typeof DbClient;
type ConnectionRow = typeof schema.whatsappConnection.$inferSelect;

/**
 * Estados que cuentan contra el cupo `whatsapp_numbers` (números comprometidos).
 * `pending` NO cuenta: es un intento en curso, reusable, no un número real;
 * si contara, un pendiente atascado bloquearía reintentar en planes con tope 1.
 */
const COUNTED_STATUSES = ["connected", "needs_reconnect"] as const;
const ALLOWED_CONNECTION_TYPES: KapsoConnectionType[] = [
  "coexistence",
  "dedicated",
];
const SETUP_LANGUAGE = "es";

function redirectUrls() {
  const base = env.BETTER_AUTH_URL.replace(/\/$/, "");
  return {
    success: `${base}/whatsapp/success`,
    failure: `${base}/whatsapp/failed`,
  };
}

function normalizeStatus(value: string): WhatsappConnectionStatusT {
  switch (value) {
    case "pending":
    case "connected":
    case "disconnected":
    case "needs_reconnect":
    case "failed":
      return value;
    default:
      return "failed";
  }
}

function normalizeType(
  value: string | null,
): "coexistence" | "dedicated" | null {
  return value === "coexistence" || value === "dedicated" ? value : null;
}

function toDto(row: ConnectionRow): WhatsappConnectionDtoT {
  return {
    id: row.id,
    name: row.name,
    status: normalizeStatus(row.status),
    phoneNumberId: row.phoneNumberId,
    displayPhoneNumber: row.displayPhoneNumber,
    businessAccountId: row.businessAccountId,
    connectionType: normalizeType(row.connectionType),
    connectedAt: row.connectedAt ? row.connectedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Verifica owner/admin sobre la organización activa del ctx. */
async function assertCanManage(ctx: TenantServiceContext): Promise<void> {
  const memberRow = await ctx.db
    .select({ role: schema.member.role })
    .from(schema.member)
    .where(
      and(
        eq(schema.member.userId, ctx.currentUser.id),
        eq(schema.member.organizationId, ctx.currentOrg.id),
      ),
    )
    .limit(1);

  const raw = memberRow[0]?.role;
  const orgRole: OrgRole | null =
    raw === "owner" || raw === "admin" || raw === "member" ? raw : null;
  const isSuperAdmin = ctx.currentUser.role === "admin";

  if (!can({ isSuperAdmin, orgRole }, "org.whatsapp.connect")) {
    throw DomainErrors.forbidden(
      "Solo un propietario o administrador puede administrar las conexiones de WhatsApp.",
    );
  }
}

async function loadConnection(
  ctx: TenantServiceContext,
  id: string,
): Promise<ConnectionRow> {
  const rows = await ctx.db
    .select()
    .from(schema.whatsappConnection)
    .where(
      and(
        eq(schema.whatsappConnection.id, id),
        eq(schema.whatsappConnection.organizationId, ctx.currentOrg.id),
      ),
    )
    .limit(1);

  if (!rows[0]) {
    throw DomainErrors.notFound("Conexión de WhatsApp no encontrada.");
  }
  return rows[0];
}

/**
 * ¿El error es el 404 "Customer not found" de Kapso? Indica que el
 * `kapsoCustomerId` persistido quedó huérfano (customer borrado en Kapso o
 * creado en otra cuenta/entorno). Se recupera recreando el customer.
 */
function isCustomerNotFound(err: unknown): boolean {
  return (
    err instanceof KapsoApiError &&
    err.status === 404 &&
    err.body.includes("Customer not found")
  );
}

/** Crea un customer nuevo en Kapso y lo persiste en la organización. */
async function createAndPersistKapsoCustomer(
  ctx: TenantServiceContext,
): Promise<string> {
  const org = ctx.currentOrg;
  const customer = await createCustomer({
    externalCustomerId: org.id,
    name: org.name,
  });

  await ctx.db
    .update(schema.organization)
    .set({ kapsoCustomerId: customer.id })
    .where(eq(schema.organization.id, org.id));

  return customer.id;
}

/** Crea (perezosamente) el customer de Kapso y lo persiste en la organización. */
async function ensureKapsoCustomer(ctx: TenantServiceContext): Promise<string> {
  const org = ctx.currentOrg;
  const row = await ctx.db
    .select({ kapsoCustomerId: schema.organization.kapsoCustomerId })
    .from(schema.organization)
    .where(eq(schema.organization.id, org.id))
    .limit(1);

  const existing = row[0]?.kapsoCustomerId;
  if (existing) return existing;

  return createAndPersistKapsoCustomer(ctx);
}

/**
 * Genera un setup link tolerando un `kapsoCustomerId` huérfano: si Kapso
 * responde 404 "Customer not found", recrea el customer (lo persiste en la org)
 * y reintenta UNA vez. Devuelve el `customerId` efectivamente usado para que el
 * llamador lo persista en la conexión.
 */
async function setupLinkWithSelfHeal(
  ctx: TenantServiceContext,
  kapsoCustomerId: string,
): Promise<{ customerId: string; link: KapsoSetupLink }> {
  try {
    return { customerId: kapsoCustomerId, link: await generateConnectSetupLink(kapsoCustomerId) };
  } catch (err) {
    if (!isCustomerNotFound(err)) throw err;
    ctx.logger.warn("[whatsapp] customer de Kapso huérfano; recreando", {
      kapsoCustomerId,
      organizationId: ctx.currentOrg.id,
    });
    const freshId = await createAndPersistKapsoCustomer(ctx);
    return { customerId: freshId, link: await generateConnectSetupLink(freshId) };
  }
}

async function countConnectionsTowardLimit(
  ctx: TenantServiceContext,
): Promise<number> {
  const rows = await ctx.db
    .select({ id: schema.whatsappConnection.id })
    .from(schema.whatsappConnection)
    .where(
      and(
        eq(schema.whatsappConnection.organizationId, ctx.currentOrg.id),
        inArray(schema.whatsappConnection.status, [...COUNTED_STATUSES]),
      ),
    );
  return rows.length;
}

async function generateConnectSetupLink(
  kapsoCustomerId: string,
  reconnectPhoneNumber?: string,
) {
  const urls = redirectUrls();
  return createSetupLink(kapsoCustomerId, {
    successRedirectUrl: urls.success,
    failureRedirectUrl: urls.failure,
    allowedConnectionTypes: ALLOWED_CONNECTION_TYPES,
    language: SETUP_LANGUAGE,
    ...(reconnectPhoneNumber ? { reconnectPhoneNumber } : {}),
  });
}

/**
 * Genera (o regenera) un setup link y deja una conexión `pending` correlacionada
 * por `setup_link_id`. Solo owner/admin.
 *
 * Si ya existe un intento `pending`, lo REUTILIZA y regenera el link (Kapso
 * revoca el anterior): así reintentar funciona sin acumular filas ni consumir
 * otro cupo. Solo al crear un número nuevo se aplica el gating `whatsapp_numbers`.
 */
export async function connectWhatsApp(
  ctx: TenantServiceContext,
): Promise<SetupLinkResponseT> {
  await assertCanManage(ctx);
  const kapsoCustomerId = await ensureKapsoCustomer(ctx);

  // Reutilizar el intento pendiente más reciente, si existe.
  const pending = await ctx.db
    .select()
    .from(schema.whatsappConnection)
    .where(
      and(
        eq(schema.whatsappConnection.organizationId, ctx.currentOrg.id),
        eq(schema.whatsappConnection.status, "pending"),
      ),
    )
    .orderBy(desc(schema.whatsappConnection.createdAt))
    .limit(1);

  if (pending[0]) {
    const { customerId, link } = await setupLinkWithSelfHeal(ctx, kapsoCustomerId);
    await ctx.db
      .update(schema.whatsappConnection)
      .set({ kapsoCustomerId: customerId, setupLinkId: link.id, updatedAt: new Date() })
      .where(eq(schema.whatsappConnection.id, pending[0].id));
    return {
      connectionId: pending[0].id,
      url: link.url,
      setupLinkId: link.id,
      expiresAt: link.expiresAt,
    };
  }

  // Número nuevo: aplica el gating del plan.
  const current = await countConnectionsTowardLimit(ctx);
  const decision = await ctx.entitlements.authorize({
    key: "whatsapp_numbers",
    current,
    delta: 1,
  });
  if (!decision.allowed) {
    throw DomainErrors.forbidden(decision.reason);
  }

  const { customerId, link } = await setupLinkWithSelfHeal(ctx, kapsoCustomerId);
  const id = crypto.randomUUID();
  await ctx.db.insert(schema.whatsappConnection).values({
    id,
    organizationId: ctx.currentOrg.id,
    kapsoCustomerId: customerId,
    setupLinkId: link.id,
    status: "pending",
  });

  return {
    connectionId: id,
    url: link.url,
    setupLinkId: link.id,
    expiresAt: link.expiresAt,
  };
}

/** Lista las conexiones de la organización (cualquier miembro puede verlas). */
export async function listConnections(
  ctx: TenantServiceContext,
): Promise<WhatsappConnectionsResponseT> {
  const rows = await ctx.db
    .select()
    .from(schema.whatsappConnection)
    .where(eq(schema.whatsappConnection.organizationId, ctx.currentOrg.id))
    .orderBy(desc(schema.whatsappConnection.createdAt));

  return { connections: rows.map(toDto) };
}

export async function getConnection(
  ctx: TenantServiceContext,
  id: string,
): Promise<WhatsappConnectionDtoT> {
  const row = await loadConnection(ctx, id);
  return toDto(row);
}

/** Mapea `is_coexistence` de Kapso al tipo de conexión de Notify. */
function connectionTypeFromKapso(
  isCoexistence: boolean | null,
): "coexistence" | "dedicated" | null {
  if (isCoexistence === true) return "coexistence";
  if (isCoexistence === false) return "dedicated";
  return null;
}

/** Nombre preferido que provee Kapso (verified → display → label de Kapso). */
function kapsoConnectionName(n: KapsoPhoneNumber): string | null {
  return n.verifiedName ?? n.displayName ?? n.name ?? null;
}

/**
 * Nombre por defecto numerado ("WhatsApp #N") para cuando no hay nombre de
 * Kapso. N = cantidad de conexiones de la org + 1 (excluyendo la fila que se
 * está nombrando, si ya existe). Es solo un placeholder editable.
 */
async function nextConnectionName(
  db: Db,
  organizationId: string,
  excludeId?: string,
): Promise<string> {
  const rows = await db
    .select({ id: schema.whatsappConnection.id })
    .from(schema.whatsappConnection)
    .where(eq(schema.whatsappConnection.organizationId, organizationId));
  const others = excludeId
    ? rows.filter((r) => r.id !== excludeId).length
    : rows.length;
  return `WhatsApp #${others + 1}`;
}

/** Lee el `kapsoCustomerId` persistido en la organización (null si no hay). */
async function getOrgKapsoCustomerId(
  ctx: TenantServiceContext,
): Promise<string | null> {
  const row = await ctx.db
    .select({ kapsoCustomerId: schema.organization.kapsoCustomerId })
    .from(schema.organization)
    .where(eq(schema.organization.id, ctx.currentOrg.id))
    .limit(1);
  return row[0]?.kapsoCustomerId ?? null;
}

/**
 * Lista números que existen en Kapso (bajo el customer de la org) pero que aún
 * NO están en Notify. Es la base de la reconciliación manual cuando el webhook
 * `whatsapp.phone_number.created` no llegó. Solo owner/admin.
 *
 * La frontera de tenant es el `customer_id` de Kapso: solo se listan números de
 * ESTE customer, nunca de otra organización.
 */
export async function listImportablePhoneNumbers(
  ctx: TenantServiceContext,
): Promise<ImportablePhoneNumbersResponseT> {
  await assertCanManage(ctx);

  const kapsoCustomerId = await getOrgKapsoCustomerId(ctx);
  if (!kapsoCustomerId) return { numbers: [] };

  const kapsoNumbers = await listPhoneNumbers(kapsoCustomerId);

  // Números que la org ya tiene registrados en Notify (cualquier estado).
  const existingRows = await ctx.db
    .select({ phoneNumberId: schema.whatsappConnection.phoneNumberId })
    .from(schema.whatsappConnection)
    .where(eq(schema.whatsappConnection.organizationId, ctx.currentOrg.id));
  const alreadyInNotify = new Set(
    existingRows.map((r) => r.phoneNumberId).filter((v): v is string => !!v),
  );

  const numbers = kapsoNumbers
    .filter((n) => !alreadyInNotify.has(n.phoneNumberId))
    .map((n) => ({
      phoneNumberId: n.phoneNumberId,
      name: kapsoConnectionName(n),
      displayPhoneNumber: n.displayPhoneNumber,
      businessAccountId: n.businessAccountId,
      connectionType: connectionTypeFromKapso(n.isCoexistence),
      status: n.status,
    }));

  return { numbers };
}

/**
 * Importa a Notify un número que YA existe en Kapso, sin pasar por el setup link.
 * Reconciliación manual para cuando el webhook de creación no llegó. Solo
 * owner/admin. Aplica el gating `whatsapp_numbers` (importar compromete un
 * número real, igual que conectar uno nuevo) y verifica que el número pertenezca
 * al customer de la org (frontera de tenant).
 *
 * Idempotente: si el número ya está `connected` en Notify, lo devuelve sin tocar
 * nada. Reusa el `pending` correlacionado si existe, igual que el webhook.
 */
export async function importPhoneNumber(
  ctx: TenantServiceContext,
  phoneNumberId: string,
): Promise<WhatsappConnectionDtoT> {
  await assertCanManage(ctx);

  const kapsoCustomerId = await getOrgKapsoCustomerId(ctx);
  if (!kapsoCustomerId) {
    throw DomainErrors.conflict(
      "La organización aún no tiene una cuenta de Kapso. Usa Conectar primero.",
    );
  }

  // Fuente de verdad: el número en Kapso. Valida existencia y pertenencia.
  let kapsoNumber: KapsoPhoneNumber;
  try {
    kapsoNumber = await getPhoneNumber(phoneNumberId);
  } catch (err) {
    if (err instanceof KapsoApiError && err.status === 404) {
      throw DomainErrors.notFound("El número no existe en Kapso.");
    }
    throw err;
  }

  if (kapsoNumber.customerId !== kapsoCustomerId) {
    throw DomainErrors.forbidden(
      "Ese número no pertenece a esta organización.",
    );
  }

  const details = {
    phoneNumberId: kapsoNumber.phoneNumberId,
    businessAccountId: kapsoNumber.businessAccountId,
    displayPhoneNumber: kapsoNumber.displayPhoneNumber,
    connectionType: connectionTypeFromKapso(kapsoNumber.isCoexistence),
  };

  // ¿Ya existe una conexión con este número en Notify?
  const existing = await ctx.db
    .select()
    .from(schema.whatsappConnection)
    .where(
      and(
        eq(schema.whatsappConnection.organizationId, ctx.currentOrg.id),
        eq(schema.whatsappConnection.phoneNumberId, kapsoNumber.phoneNumberId),
      ),
    )
    .limit(1);

  if (existing[0]?.status === "connected") return toDto(existing[0]); // idempotente

  // Gating: solo si el número aún NO cuenta contra el cupo (un connected/
  // needs_reconnect ya lo hace; pending/disconnected/failed/nuevo, no).
  const alreadyCounted =
    existing[0] != null &&
    (COUNTED_STATUSES as readonly string[]).includes(existing[0].status);
  if (!alreadyCounted) {
    const current = await countConnectionsTowardLimit(ctx);
    const decision = await ctx.entitlements.authorize({
      key: "whatsapp_numbers",
      current,
      delta: 1,
    });
    if (!decision.allowed) throw DomainErrors.forbidden(decision.reason);
  }

  // Caso 1: existe una fila para este número → consolidarla a connected.
  if (existing[0]) {
    const name =
      existing[0].name ?? // respeta un nombre custom ya puesto por el usuario
      kapsoConnectionName(kapsoNumber) ??
      (await nextConnectionName(ctx.db, ctx.currentOrg.id, existing[0].id));
    const updated = await ctx.db
      .update(schema.whatsappConnection)
      .set({
        ...details,
        name,
        status: "connected",
        connectedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.whatsappConnection.id, existing[0].id))
      .returning();
    return toDto(updated[0]);
  }

  // Caso 2: promover el pending más reciente del customer (igual que el webhook).
  const pending = await ctx.db
    .select()
    .from(schema.whatsappConnection)
    .where(
      and(
        eq(schema.whatsappConnection.organizationId, ctx.currentOrg.id),
        eq(schema.whatsappConnection.kapsoCustomerId, kapsoCustomerId),
        eq(schema.whatsappConnection.status, "pending"),
      ),
    )
    .orderBy(desc(schema.whatsappConnection.createdAt))
    .limit(1);

  if (pending[0]) {
    const name =
      kapsoConnectionName(kapsoNumber) ??
      (await nextConnectionName(ctx.db, ctx.currentOrg.id, pending[0].id));
    const updated = await ctx.db
      .update(schema.whatsappConnection)
      .set({
        ...details,
        name,
        status: "connected",
        connectedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.whatsappConnection.id, pending[0].id))
      .returning();
    return toDto(updated[0]);
  }

  // Caso 3: no había rastro en Notify → insertar la conexión consolidada.
  const name =
    kapsoConnectionName(kapsoNumber) ??
    (await nextConnectionName(ctx.db, ctx.currentOrg.id));
  const inserted = await ctx.db
    .insert(schema.whatsappConnection)
    .values({
      id: crypto.randomUUID(),
      organizationId: ctx.currentOrg.id,
      kapsoCustomerId,
      ...details,
      name,
      status: "connected",
      connectedAt: new Date(),
    })
    .returning();
  return toDto(inserted[0]);
}

/** Renombra una conexión (etiqueta editable). Solo owner/admin. */
export async function renameConnection(
  ctx: TenantServiceContext,
  id: string,
  name: string,
): Promise<WhatsappConnectionDtoT> {
  await assertCanManage(ctx);
  await loadConnection(ctx, id); // valida pertenencia a la org

  const trimmed = name.trim();
  if (!trimmed) {
    throw DomainErrors.conflict("El nombre no puede estar vacío.");
  }

  const updated = await ctx.db
    .update(schema.whatsappConnection)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(
      and(
        eq(schema.whatsappConnection.id, id),
        eq(schema.whatsappConnection.organizationId, ctx.currentOrg.id),
      ),
    )
    .returning();

  return toDto(updated[0]);
}

/**
 * Desconecta: solicita a Kapso eliminar el número y marca `disconnected` de
 * forma optimista. El webhook `whatsapp.phone_number.deleted` lo consolida.
 */
export async function disconnect(
  ctx: TenantServiceContext,
  id: string,
): Promise<WhatsappConnectionDtoT> {
  await assertCanManage(ctx);
  const row = await loadConnection(ctx, id);

  // Sin número (pending/failed): cancelar = eliminar la fila del intento.
  if (!row.phoneNumberId) {
    await ctx.db
      .delete(schema.whatsappConnection)
      .where(eq(schema.whatsappConnection.id, row.id));
    return toDto({ ...row, status: "disconnected" });
  }

  // Número real: pedir a Kapso eliminarlo. El webhook .deleted consolida.
  try {
    await deletePhoneNumber(row.phoneNumberId);
  } catch (err) {
    // Si Kapso ya no lo tiene (404), seguimos: el objetivo es desconectar.
    if (!(err instanceof KapsoApiError && err.status === 404)) {
      throw err;
    }
    ctx.logger.warn("[whatsapp] número ya inexistente en Kapso", {
      phoneNumberId: row.phoneNumberId,
    });
  }

  const updated = await ctx.db
    .update(schema.whatsappConnection)
    .set({ status: "disconnected", updatedAt: new Date() })
    .where(eq(schema.whatsappConnection.id, row.id))
    .returning();

  return toDto(updated[0]);
}

/**
 * Reconecta un número roto: genera un setup link con `reconnect_phone_number`.
 * Kapso fuerza provision=false y fija el tipo al config existente.
 */
export async function reconnect(
  ctx: TenantServiceContext,
  id: string,
): Promise<SetupLinkResponseT> {
  await assertCanManage(ctx);
  const row = await loadConnection(ctx, id);

  if (!row.phoneNumberId) {
    throw DomainErrors.conflict(
      "Esta conexión aún no tiene un número para reconectar.",
    );
  }

  // reconnect_phone_number espera el número en E.164, no el phone_number_id.
  const link = await generateConnectSetupLink(
    row.kapsoCustomerId,
    row.displayPhoneNumber ?? row.phoneNumberId,
  );

  await ctx.db
    .update(schema.whatsappConnection)
    .set({ setupLinkId: link.id, status: "needs_reconnect", updatedAt: new Date() })
    .where(eq(schema.whatsappConnection.id, row.id));

  return {
    connectionId: row.id,
    url: link.url,
    setupLinkId: link.id,
    expiresAt: link.expiresAt,
  };
}

// ── Aplicación de eventos de webhook (sin sesión; resuelve org por customer) ──

export type WhatsappWebhookDeps = { db: Db; logger: Logger };

async function resolveOrgByCustomer(
  db: Db,
  customerId: string,
): Promise<{ id: string } | null> {
  const rows = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(eq(schema.organization.kapsoCustomerId, customerId))
    .limit(1);
  return rows[0] ?? null;
}

export type PhoneNumberCreatedInput = {
  customerId: string;
  phoneNumberId: string;
  businessAccountId?: string | null;
  displayPhoneNumber?: string | null;
};

/** `whatsapp.phone_number.created`: pending → connected (idempotente). */
export async function applyPhoneNumberCreated(
  deps: WhatsappWebhookDeps,
  input: PhoneNumberCreatedInput,
): Promise<void> {
  const org = await resolveOrgByCustomer(deps.db, input.customerId);
  if (!org) {
    deps.logger.warn("[whatsapp-webhook] created: customer desconocido", {
      customerId: input.customerId,
    });
    return;
  }

  // 1) ¿Ya existe una conexión con este número? (idempotencia + reconexión).
  const existing = await deps.db
    .select()
    .from(schema.whatsappConnection)
    .where(
      and(
        eq(schema.whatsappConnection.organizationId, org.id),
        eq(schema.whatsappConnection.phoneNumberId, input.phoneNumberId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    if (existing[0].status === "connected") return; // ya aplicado
    await deps.db
      .update(schema.whatsappConnection)
      .set({
        status: "connected",
        connectedAt: new Date(),
        updatedAt: new Date(),
        businessAccountId:
          input.businessAccountId ?? existing[0].businessAccountId,
        displayPhoneNumber:
          input.displayPhoneNumber ?? existing[0].displayPhoneNumber,
        name:
          existing[0].name ??
          (await nextConnectionName(deps.db, org.id, existing[0].id)),
      })
      .where(eq(schema.whatsappConnection.id, existing[0].id));
    return;
  }

  // 2) Promover el pending más reciente de ese customer.
  const pending = await deps.db
    .select()
    .from(schema.whatsappConnection)
    .where(
      and(
        eq(schema.whatsappConnection.organizationId, org.id),
        eq(schema.whatsappConnection.kapsoCustomerId, input.customerId),
        eq(schema.whatsappConnection.status, "pending"),
      ),
    )
    .orderBy(desc(schema.whatsappConnection.createdAt))
    .limit(1);

  if (pending[0]) {
    await deps.db
      .update(schema.whatsappConnection)
      .set({
        status: "connected",
        phoneNumberId: input.phoneNumberId,
        businessAccountId: input.businessAccountId ?? null,
        displayPhoneNumber: input.displayPhoneNumber ?? null,
        connectedAt: new Date(),
        updatedAt: new Date(),
        name:
          pending[0].name ??
          (await nextConnectionName(deps.db, org.id, pending[0].id)),
      })
      .where(eq(schema.whatsappConnection.id, pending[0].id));
    return;
  }

  // 3) Defensivo: conexión surgida fuera del flujo pending de Notify.
  await deps.db.insert(schema.whatsappConnection).values({
    id: crypto.randomUUID(),
    organizationId: org.id,
    kapsoCustomerId: input.customerId,
    phoneNumberId: input.phoneNumberId,
    businessAccountId: input.businessAccountId ?? null,
    displayPhoneNumber: input.displayPhoneNumber ?? null,
    name: await nextConnectionName(deps.db, org.id),
    status: "connected",
    connectedAt: new Date(),
  });
}

export type PhoneNumberDeletedInput = {
  customerId: string;
  phoneNumberId: string;
};

/** `whatsapp.phone_number.deleted`: → disconnected (idempotente, anti-drift). */
export async function applyPhoneNumberDeleted(
  deps: WhatsappWebhookDeps,
  input: PhoneNumberDeletedInput,
): Promise<void> {
  const org = await resolveOrgByCustomer(deps.db, input.customerId);
  if (!org) {
    deps.logger.warn("[whatsapp-webhook] deleted: customer desconocido", {
      customerId: input.customerId,
    });
    return;
  }

  const existing = await deps.db
    .select()
    .from(schema.whatsappConnection)
    .where(
      and(
        eq(schema.whatsappConnection.organizationId, org.id),
        eq(schema.whatsappConnection.phoneNumberId, input.phoneNumberId),
      ),
    )
    .limit(1);

  if (!existing[0]) {
    deps.logger.warn("[whatsapp-webhook] deleted: número desconocido", {
      phoneNumberId: input.phoneNumberId,
    });
    return;
  }
  if (existing[0].status === "disconnected") return; // ya aplicado

  await deps.db
    .update(schema.whatsappConnection)
    .set({ status: "disconnected", updatedAt: new Date() })
    .where(eq(schema.whatsappConnection.id, existing[0].id));
}

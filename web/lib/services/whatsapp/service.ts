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
  KapsoApiError,
  type KapsoConnectionType,
} from "@/lib/integrations/kapso/client";
import type { TenantServiceContext } from "@/lib/services/context";
import { DomainErrors } from "@/lib/services/errors";
import type { Logger } from "@/lib/services/logger";
import type {
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
    const link = await generateConnectSetupLink(kapsoCustomerId);
    await ctx.db
      .update(schema.whatsappConnection)
      .set({ setupLinkId: link.id, updatedAt: new Date() })
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

  const link = await generateConnectSetupLink(kapsoCustomerId);
  const id = crypto.randomUUID();
  await ctx.db.insert(schema.whatsappConnection).values({
    id,
    organizationId: ctx.currentOrg.id,
    kapsoCustomerId,
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

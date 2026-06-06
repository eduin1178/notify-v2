/**
 * Lógica de dominio del inbox (arquitectura híbrida, change add-inbox).
 *
 * Módulo puro: NO importa `next/*`, `hono`, `@hono/*` ni `web/app/**`.
 * - Lectura (TenantServiceContext): la lista sale del ÍNDICE local; el hilo de
 *   mensajes se lee de Kapso por read-through.
 * - Ingestión (deps {db, logger}): la invoca el webhook; hace upsert del índice,
 *   crea el contacto al vuelo, aplica la reapertura configurable y mide el uso.
 *
 * Aislamiento multi-tenant: las queries de lectura SIEMPRE filtran por
 * `ctx.currentOrg.id`. La ingestión resuelve la org por `phone_number_id`.
 */

import { and, desc, eq, ilike, isNotNull, isNull, ne, or, sql } from "drizzle-orm";

import { can, type OrgRole } from "@/lib/auth/permissions";
import type { db as DbClient } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";
import { listMessages, markMessageRead } from "@/lib/integrations/kapso/client";
import type { TenantServiceContext } from "@/lib/services/context";
import { DomainErrors } from "@/lib/services/errors";
import type { Logger } from "@/lib/services/logger";
import { normalizePhone } from "@/lib/services/contacts/phone";
import {
  recordConversationWindow,
  recordMessageUsage,
} from "@/lib/services/inbox/usage";
import {
  isWindowOpen,
  opensNewWindow,
  windowClosesAt,
} from "@/lib/services/inbox/window";
import type {
  ConversationDtoT,
  ConversationListResponseT,
  InboxNumberDtoT,
  InboxSettingsDtoT,
  ListConversationsQueryT,
  MessageThreadQueryT,
  MessageThreadResponseT,
  NotifyStatusT,
  ReopenBehaviorT,
  UpdateInboxSettingsInputT,
} from "@/lib/services/inbox/schemas";

type Db = typeof DbClient;
type ConversationRow = typeof schema.conversation.$inferSelect;

// ── Lectura ──────────────────────────────────────────────────────────────────

/** Números `connected` de la organización para el selector del inbox (req #6). */
export async function listNumbers(
  ctx: TenantServiceContext,
): Promise<InboxNumberDtoT[]> {
  const rows = await ctx.db
    .select({
      connectionId: schema.whatsappConnection.id,
      phoneNumberId: schema.whatsappConnection.phoneNumberId,
      displayPhoneNumber: schema.whatsappConnection.displayPhoneNumber,
      name: schema.whatsappConnection.name,
    })
    .from(schema.whatsappConnection)
    .where(
      and(
        eq(schema.whatsappConnection.organizationId, ctx.currentOrg.id),
        eq(schema.whatsappConnection.status, "connected"),
      ),
    )
    .orderBy(desc(schema.whatsappConnection.connectedAt));
  return rows;
}

async function assertConnectionOwned(
  ctx: TenantServiceContext,
  connectionId: string,
): Promise<void> {
  const rows = await ctx.db
    .select({ id: schema.whatsappConnection.id })
    .from(schema.whatsappConnection)
    .where(
      and(
        eq(schema.whatsappConnection.id, connectionId),
        eq(schema.whatsappConnection.organizationId, ctx.currentOrg.id),
      ),
    )
    .limit(1);
  if (!rows[0]) {
    throw DomainErrors.notFound("Número de WhatsApp no encontrado.");
  }
}

type ConversationJoinRow = {
  conv: ConversationRow;
  contactId: string | null;
  contactFirst: string | null;
  contactLast: string | null;
  contactPhone: string | null;
  userId: string | null;
  userName: string | null;
  userImage: string | null;
};

function toConversationDto(
  row: ConversationJoinRow,
  now: Date,
): ConversationDtoT {
  const c = row.conv;
  return {
    id: c.id,
    kapsoConversationId: c.kapsoConversationId,
    connectionId: c.whatsappConnectionId,
    phoneNumber: c.phoneNumber,
    contact:
      row.contactId && row.contactFirst != null && row.contactPhone != null
        ? {
            id: row.contactId,
            firstName: row.contactFirst,
            lastName: row.contactLast,
            phone: row.contactPhone,
          }
        : null,
    notifyStatus: c.notifyStatus as ConversationDtoT["notifyStatus"],
    assignedUser:
      row.userId && row.userName != null
        ? { id: row.userId, name: row.userName, image: row.userImage }
        : null,
    lastInboundAt: c.lastInboundAt?.toISOString() ?? null,
    lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
    lastMessageText: c.lastMessageText,
    lastMessageType: c.lastMessageType,
    unreadCount: c.unreadCount,
    windowOpen: isWindowOpen(c.lastInboundAt, now),
    windowClosesAt: windowClosesAt(c.lastInboundAt)?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

/** Lista paginada del índice local, filtrable por estado/asignación/búsqueda. */
export async function listConversations(
  ctx: TenantServiceContext,
  query: ListConversationsQueryT,
): Promise<ConversationListResponseT> {
  await assertConnectionOwned(ctx, query.connectionId);

  const conditions = [
    eq(schema.conversation.organizationId, ctx.currentOrg.id),
    eq(schema.conversation.whatsappConnectionId, query.connectionId),
  ];

  if (query.status) {
    conditions.push(eq(schema.conversation.notifyStatus, query.status));
  }

  if (query.assignment === "mine") {
    conditions.push(eq(schema.conversation.assignedUserId, ctx.currentUser.id));
  } else if (query.assignment === "unassigned") {
    conditions.push(isNull(schema.conversation.assignedUserId));
  } else if (query.assignment === "others") {
    conditions.push(isNotNull(schema.conversation.assignedUserId));
    conditions.push(ne(schema.conversation.assignedUserId, ctx.currentUser.id));
  }

  if (query.search) {
    const term = `%${query.search}%`;
    conditions.push(
      or(
        ilike(schema.conversation.lastMessageText, term),
        ilike(schema.conversation.phoneNumber, term),
        ilike(schema.contact.firstName, term),
        ilike(schema.contact.lastName, term),
        ilike(schema.contact.phone, term),
      )!,
    );
  }

  const whereClause = and(...conditions);

  const totalRows = await ctx.db
    .select({ value: sql<number>`count(*)` })
    .from(schema.conversation)
    .leftJoin(
      schema.contact,
      eq(schema.conversation.contactId, schema.contact.id),
    )
    .where(whereClause);
  const total = Number(totalRows[0]?.value ?? 0);
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize);

  const rows = await ctx.db
    .select({
      conv: schema.conversation,
      contactId: schema.contact.id,
      contactFirst: schema.contact.firstName,
      contactLast: schema.contact.lastName,
      contactPhone: schema.contact.phone,
      userId: schema.user.id,
      userName: schema.user.name,
      userImage: schema.user.image,
    })
    .from(schema.conversation)
    .leftJoin(
      schema.contact,
      eq(schema.conversation.contactId, schema.contact.id),
    )
    .leftJoin(
      schema.user,
      eq(schema.conversation.assignedUserId, schema.user.id),
    )
    .where(whereClause)
    .orderBy(desc(schema.conversation.lastMessageAt), desc(schema.conversation.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  const now = new Date();
  return {
    items: rows.map((r) => toConversationDto(r, now)),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages,
  };
}

async function loadOwnedConversation(
  ctx: TenantServiceContext,
  id: string,
): Promise<ConversationRow> {
  const rows = await ctx.db
    .select()
    .from(schema.conversation)
    .where(
      and(
        eq(schema.conversation.id, id),
        eq(schema.conversation.organizationId, ctx.currentOrg.id),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw DomainErrors.notFound("Conversación no encontrada.");
  }
  return row;
}

/** Hilo de mensajes de una conversación (read-through desde Kapso). */
export async function getMessages(
  ctx: TenantServiceContext,
  conversationId: string,
  query: MessageThreadQueryT,
): Promise<MessageThreadResponseT> {
  const conversation = await loadOwnedConversation(ctx, conversationId);

  // Sin id de Kapso aún (p. ej. proactiva sin primer mensaje) → hilo vacío.
  if (!conversation.kapsoConversationId) {
    return { items: [], nextCursor: null };
  }

  const page = await listMessages({
    conversationId: conversation.kapsoConversationId,
    after: query.after,
    limit: query.limit,
  });

  return { items: page.messages, nextCursor: page.nextCursor };
}

// ── Gestión (Fase 2) ─────────────────────────────────────────────────────────

/** Carga UNA conversación (con contacto y agente) como DTO. */
async function loadConversationDto(
  ctx: TenantServiceContext,
  id: string,
): Promise<ConversationDtoT> {
  const rows = await ctx.db
    .select({
      conv: schema.conversation,
      contactId: schema.contact.id,
      contactFirst: schema.contact.firstName,
      contactLast: schema.contact.lastName,
      contactPhone: schema.contact.phone,
      userId: schema.user.id,
      userName: schema.user.name,
      userImage: schema.user.image,
    })
    .from(schema.conversation)
    .leftJoin(
      schema.contact,
      eq(schema.conversation.contactId, schema.contact.id),
    )
    .leftJoin(
      schema.user,
      eq(schema.conversation.assignedUserId, schema.user.id),
    )
    .where(
      and(
        eq(schema.conversation.id, id),
        eq(schema.conversation.organizationId, ctx.currentOrg.id),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw DomainErrors.notFound("Conversación no encontrada.");
  }
  return toConversationDto(row, new Date());
}

/** Cambia el estado de negocio (abierta/pendiente/cerrada). */
export async function setConversationStatus(
  ctx: TenantServiceContext,
  id: string,
  status: NotifyStatusT,
): Promise<ConversationDtoT> {
  await loadOwnedConversation(ctx, id);
  await ctx.db
    .update(schema.conversation)
    .set({ notifyStatus: status, updatedAt: new Date() })
    .where(
      and(
        eq(schema.conversation.id, id),
        eq(schema.conversation.organizationId, ctx.currentOrg.id),
      ),
    );
  return loadConversationDto(ctx, id);
}

/** Asigna (o desasigna con `userId = null`) una conversación a un agente. */
export async function assignConversation(
  ctx: TenantServiceContext,
  id: string,
  userId: string | null,
): Promise<ConversationDtoT> {
  await loadOwnedConversation(ctx, id);

  if (userId) {
    const member = await ctx.db
      .select({ id: schema.member.id })
      .from(schema.member)
      .where(
        and(
          eq(schema.member.userId, userId),
          eq(schema.member.organizationId, ctx.currentOrg.id),
        ),
      )
      .limit(1);
    if (!member[0]) {
      throw DomainErrors.notFound(
        "El usuario indicado no es miembro de la organización.",
      );
    }
  }

  await ctx.db
    .update(schema.conversation)
    .set({ assignedUserId: userId, updatedAt: new Date() })
    .where(
      and(
        eq(schema.conversation.id, id),
        eq(schema.conversation.organizationId, ctx.currentOrg.id),
      ),
    );
  return loadConversationDto(ctx, id);
}

/**
 * Marca la conversación como leída: pone los no leídos en cero y, si el número
 * tiene `send_read_receipts` activado, envía el acuse de lectura a WhatsApp
 * (✓✓ azul) sobre el último mensaje entrante. El acuse es best-effort.
 */
export async function markRead(
  ctx: TenantServiceContext,
  id: string,
): Promise<ConversationDtoT> {
  const conversation = await loadOwnedConversation(ctx, id);

  await ctx.db
    .update(schema.conversation)
    .set({ unreadCount: 0, updatedAt: new Date() })
    .where(
      and(
        eq(schema.conversation.id, id),
        eq(schema.conversation.organizationId, ctx.currentOrg.id),
      ),
    );

  if (conversation.kapsoConversationId) {
    const settings = await resolveSettings(
      ctx.db,
      conversation.whatsappConnectionId,
    );
    if (settings.sendReadReceipts) {
      try {
        const connection = await ctx.db
          .select({ phoneNumberId: schema.whatsappConnection.phoneNumberId })
          .from(schema.whatsappConnection)
          .where(eq(schema.whatsappConnection.id, conversation.whatsappConnectionId))
          .limit(1);
        const phoneNumberId = connection[0]?.phoneNumberId;
        if (phoneNumberId) {
          const page = await listMessages({
            conversationId: conversation.kapsoConversationId,
            limit: 15,
          });
          const lastInbound = page.messages.find(
            (m) => m.direction === "inbound",
          );
          if (lastInbound) {
            await markMessageRead(phoneNumberId, lastInbound.id);
          }
        }
      } catch (err) {
        ctx.logger.warn("[inbox] no se pudo enviar acuse de lectura", {
          conversationId: id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return loadConversationDto(ctx, id);
}

// ── Configuración por número (inbox_settings) ────────────────────────────────

/** Verifica owner/admin sobre la organización activa (config del inbox). */
async function assertCanConfigure(ctx: TenantServiceContext): Promise<void> {
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

  if (!can({ isSuperAdmin, orgRole }, "org.inbox.configure")) {
    throw DomainErrors.forbidden(
      "Solo un propietario o administrador puede configurar el inbox.",
    );
  }
}

/** Settings efectivos de un número (con defaults si no hay fila). */
async function resolveSettings(
  db: Db,
  connectionId: string,
): Promise<{ reopenBehavior: ReopenBehaviorT; sendReadReceipts: boolean }> {
  const rows = await db
    .select({
      reopenBehavior: schema.inboxSettings.reopenBehavior,
      sendReadReceipts: schema.inboxSettings.sendReadReceipts,
    })
    .from(schema.inboxSettings)
    .where(eq(schema.inboxSettings.whatsappConnectionId, connectionId))
    .limit(1);

  const row = rows[0];
  const reopen = row?.reopenBehavior;
  return {
    reopenBehavior:
      reopen === "reopen_keep_agent" ||
      reopen === "reopen_unassign" ||
      reopen === "stay_closed"
        ? reopen
        : "reopen_keep_agent",
    sendReadReceipts: row?.sendReadReceipts ?? true,
  };
}

export async function getInboxSettings(
  ctx: TenantServiceContext,
  connectionId: string,
): Promise<InboxSettingsDtoT> {
  await assertConnectionOwned(ctx, connectionId);
  const settings = await resolveSettings(ctx.db, connectionId);
  return { connectionId, ...settings };
}

export async function updateInboxSettings(
  ctx: TenantServiceContext,
  connectionId: string,
  input: UpdateInboxSettingsInputT,
): Promise<InboxSettingsDtoT> {
  await assertCanConfigure(ctx);
  await assertConnectionOwned(ctx, connectionId);

  await ctx.db
    .insert(schema.inboxSettings)
    .values({
      id: crypto.randomUUID(),
      organizationId: ctx.currentOrg.id,
      whatsappConnectionId: connectionId,
      reopenBehavior: input.reopenBehavior,
      sendReadReceipts: input.sendReadReceipts,
    })
    .onConflictDoUpdate({
      target: schema.inboxSettings.whatsappConnectionId,
      set: {
        reopenBehavior: input.reopenBehavior,
        sendReadReceipts: input.sendReadReceipts,
        updatedAt: new Date(),
      },
    });

  return {
    connectionId,
    reopenBehavior: input.reopenBehavior,
    sendReadReceipts: input.sendReadReceipts,
  };
}

// ── Ingestión por webhook ────────────────────────────────────────────────────

export type InboxWebhookDeps = { db: Db; logger: Logger };

/** Payload de `whatsapp.message.received` (subset tolerante de Kapso v2). */
export type InboundMessagePayload = {
  message?: {
    id?: string | null;
    type?: string | null;
    timestamp?: string | null;
    text?: { body?: string | null } | null;
    kapso?: { content?: string | null } | null;
  } | null;
  conversation?: {
    id?: string | null;
    phone_number?: string | null;
    phone_number_id?: string | null;
    kapso?: { contact_name?: string | null } | null;
  } | null;
  phone_number_id?: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  image: "[Imagen]",
  video: "[Video]",
  audio: "[Audio]",
  document: "[Documento]",
  sticker: "[Sticker]",
  location: "[Ubicación]",
  contacts: "[Contacto]",
  interactive: "[Mensaje interactivo]",
  button: "[Respuesta]",
  template: "[Plantilla]",
  order: "[Pedido]",
};

function previewOf(type: string, text: string | null): string {
  if (text && text.trim()) return text.trim().slice(0, 500);
  return TYPE_LABELS[type] ?? "[Mensaje]";
}

function parseTimestamp(raw: string | null | undefined): Date {
  if (!raw) return new Date();
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds > 0) {
    return new Date(seconds * 1000);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

async function resolveConnectionByPhoneNumberId(
  db: Db,
  phoneNumberId: string,
): Promise<{ id: string; organizationId: string } | null> {
  const rows = await db
    .select({
      id: schema.whatsappConnection.id,
      organizationId: schema.whatsappConnection.organizationId,
      status: schema.whatsappConnection.status,
    })
    .from(schema.whatsappConnection)
    .where(eq(schema.whatsappConnection.phoneNumberId, phoneNumberId))
    .limit(2);

  if (rows.length === 0) return null;
  // Preferir la conexión `connected` si hubiera más de una con el mismo número.
  const preferred = rows.find((r) => r.status === "connected") ?? rows[0];
  return { id: preferred.id, organizationId: preferred.organizationId };
}

/** Resuelve (o crea al vuelo) el contacto por teléfono. Null si no hay teléfono. */
async function resolveOrCreateContact(
  db: Db,
  organizationId: string,
  rawPhone: string | null | undefined,
  profileName: string | null | undefined,
): Promise<string | null> {
  if (!rawPhone) return null;
  const phone = normalizePhone(
    rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`,
  );
  if (!phone) return null;

  const existing = await db
    .select({ id: schema.contact.id })
    .from(schema.contact)
    .where(
      and(
        eq(schema.contact.organizationId, organizationId),
        eq(schema.contact.phone, phone),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0].id;

  const id = crypto.randomUUID();
  const inserted = await db
    .insert(schema.contact)
    .values({
      id,
      organizationId,
      firstName: profileName?.trim() || phone,
      lastName: null,
      phone,
      source: "whatsapp",
    })
    .onConflictDoNothing()
    .returning({ id: schema.contact.id });

  if (inserted[0]) return inserted[0].id;

  // Carrera: otro entrante lo creó primero. Releer.
  const reread = await db
    .select({ id: schema.contact.id })
    .from(schema.contact)
    .where(
      and(
        eq(schema.contact.organizationId, organizationId),
        eq(schema.contact.phone, phone),
      ),
    )
    .limit(1);
  return reread[0]?.id ?? null;
}

async function reopenBehaviorFor(
  db: Db,
  connectionId: string,
): Promise<ReopenBehaviorT> {
  const rows = await db
    .select({ reopenBehavior: schema.inboxSettings.reopenBehavior })
    .from(schema.inboxSettings)
    .where(eq(schema.inboxSettings.whatsappConnectionId, connectionId))
    .limit(1);
  const value = rows[0]?.reopenBehavior;
  if (
    value === "reopen_keep_agent" ||
    value === "reopen_unassign" ||
    value === "stay_closed"
  ) {
    return value;
  }
  return "reopen_keep_agent"; // default (design D5)
}

/**
 * Procesa un entrante: upsert del índice por `kapso_conversation_id`, contacto al
 * vuelo, ventana de 24h, reapertura configurable y medición. Idempotente por WAMID
 * en la medición; el upsert es naturalmente convergente.
 */
export async function ingestInboundMessage(
  deps: InboxWebhookDeps,
  payload: InboundMessagePayload,
): Promise<void> {
  const phoneNumberId =
    payload.conversation?.phone_number_id ?? payload.phone_number_id ?? null;
  const kapsoConversationId = payload.conversation?.id ?? null;

  if (!phoneNumberId || !kapsoConversationId) {
    deps.logger.warn("[inbox-webhook] entrante sin number/conversation id", {
      phoneNumberId,
      kapsoConversationId,
    });
    return;
  }

  const connection = await resolveConnectionByPhoneNumberId(
    deps.db,
    phoneNumberId,
  );
  if (!connection) {
    deps.logger.warn("[inbox-webhook] número desconocido; ignorado", {
      phoneNumberId,
    });
    return;
  }

  const orgId = connection.organizationId;
  const type = payload.message?.type ?? "text";
  const text = payload.message?.text?.body ?? payload.message?.kapso?.content ?? null;
  const preview = previewOf(type, text);
  const ts = parseTimestamp(payload.message?.timestamp);
  const wamid = payload.message?.id ?? null;
  const phone = payload.conversation?.phone_number ?? null;
  const profileName = payload.conversation?.kapso?.contact_name ?? null;

  const contactId = await resolveOrCreateContact(
    deps.db,
    orgId,
    phone,
    profileName,
  );

  const existingRows = await deps.db
    .select()
    .from(schema.conversation)
    .where(eq(schema.conversation.kapsoConversationId, kapsoConversationId))
    .limit(1);
  const existing = existingRows[0];

  const newWindow = opensNewWindow(existing?.lastInboundAt ?? null, ts);

  if (existing) {
    let status = existing.notifyStatus;
    let assignedUserId: string | null = existing.assignedUserId;

    if (existing.notifyStatus === "cerrada") {
      const behavior = await reopenBehaviorFor(deps.db, connection.id);
      if (behavior === "reopen_keep_agent") {
        status = "abierta";
      } else if (behavior === "reopen_unassign") {
        status = "abierta";
        assignedUserId = null;
      } // stay_closed: sin cambios
    }

    await deps.db
      .update(schema.conversation)
      .set({
        lastInboundAt: ts,
        lastMessageAt: ts,
        lastMessageText: preview,
        lastMessageType: type,
        unreadCount: sql`${schema.conversation.unreadCount} + 1`,
        contactId: existing.contactId ?? contactId,
        notifyStatus: status,
        assignedUserId,
        phoneNumber: existing.phoneNumber ?? phone,
        updatedAt: new Date(),
      })
      .where(eq(schema.conversation.id, existing.id));
  } else {
    await deps.db.insert(schema.conversation).values({
      id: crypto.randomUUID(),
      organizationId: orgId,
      whatsappConnectionId: connection.id,
      contactId,
      kapsoConversationId,
      phoneNumber: phone,
      notifyStatus: "abierta",
      assignedUserId: null,
      lastInboundAt: ts,
      lastMessageAt: ts,
      lastMessageText: preview,
      lastMessageType: type,
      unreadCount: 1,
    });
  }

  if (wamid) {
    await recordMessageUsage(deps.db, {
      organizationId: orgId,
      wamid,
      direction: "inbound",
    });
  }
  if (newWindow) {
    await recordConversationWindow(deps.db, orgId);
  }
}

/** Payload de `whatsapp.message.sent|delivered|read|failed`. */
export type DeliveryStatusPayload = {
  message?: { id?: string | null; kapso?: { status?: string | null } | null } | null;
  phone_number_id?: string | null;
};

/**
 * Estado de entrega de un saliente. En la Fase 1 el hilo refleja el estado por
 * read-through (Kapso ya lo expone en `message.kapso.status`), así que aquí solo
 * se registra para trazabilidad; la reflexión enriquecida llega en la Fase 3.
 */
export async function ingestDeliveryStatus(
  deps: InboxWebhookDeps,
  payload: DeliveryStatusPayload,
): Promise<void> {
  deps.logger.info("[inbox-webhook] estado de entrega", {
    wamid: payload.message?.id ?? null,
    status: payload.message?.kapso?.status ?? null,
  });
}

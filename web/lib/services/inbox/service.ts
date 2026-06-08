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
import {
  listMessages,
  listTemplates as kapsoListTemplates,
  markMessageRead,
  sendInteractive,
  sendMessage,
  sendTemplate,
  type InteractivePayload,
  type KapsoTemplate,
  type OutboundMessage,
  type TemplateSendComponent,
} from "@/lib/integrations/kapso/client";
import {
  createPresignedUpload,
  R2Error,
} from "@/lib/integrations/r2/client";
import type { TenantServiceContext } from "@/lib/services/context";
import { DomainErrors } from "@/lib/services/errors";
import type { Logger } from "@/lib/services/logger";
import { normalizePhone } from "@/lib/services/contacts/phone";
import { convChannel, orgChannel } from "@/lib/services/realtime/channels";
import type { RealtimePublisher } from "@/lib/services/realtime/ports";
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
  MessageDtoT,
  MessageThreadQueryT,
  MessageThreadResponseT,
  NotifyStatusT,
  PresignUploadInputT,
  PresignUploadResponseT,
  ReopenBehaviorT,
  SendInteractiveInputT,
  SendServiceMessageInputT,
  SendServiceMessageResponseT,
  SendTemplateInputT,
  StartConversationInputT,
  TemplateDtoT,
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

/**
 * Devuelve una conversación del índice local por id, como DTO (con contacto y
 * agente). Incluye `connectionId`, necesario para que el deep-link `?c=<id>`
 * abra una conversación de un número distinto al seleccionado.
 */
export async function getConversationById(
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

// ── Envío de servicio + media (Fase 3) ───────────────────────────────────────

/** `phone_number_id` de Meta para una conexión de la org (o null si no aplica). */
async function phoneNumberIdOf(
  db: Db,
  connectionId: string,
): Promise<string | null> {
  const rows = await db
    .select({ phoneNumberId: schema.whatsappConnection.phoneNumberId })
    .from(schema.whatsappConnection)
    .where(eq(schema.whatsappConnection.id, connectionId))
    .limit(1);
  return rows[0]?.phoneNumberId ?? null;
}

/** Construye el mensaje saliente de Kapso a partir del input del composer. */
function toOutboundMessage(
  to: string,
  input: SendServiceMessageInputT,
): OutboundMessage {
  switch (input.type) {
    case "text":
      return { type: "text", to, text: input.text ?? "" };
    case "image":
      return { type: "image", to, link: input.mediaUrl!, caption: input.text ?? null };
    case "video":
      return { type: "video", to, link: input.mediaUrl!, caption: input.text ?? null };
    case "audio":
      return { type: "audio", to, link: input.mediaUrl! };
    case "document":
      return {
        type: "document",
        to,
        link: input.mediaUrl!,
        filename: input.filename ?? null,
        caption: input.text ?? null,
      };
  }
}

/**
 * Envía un mensaje de servicio (texto o media) dentro de la ventana de 24h.
 * Rechaza fuera de ventana (debe usarse plantilla, design D6/D10), envía por
 * Kapso, actualiza el preview/`last_outbound_at`, pone los no leídos en cero y
 * mide el uso saliente (dedup por WAMID, design D7).
 */
export async function sendServiceMessage(
  ctx: TenantServiceContext,
  conversationId: string,
  input: SendServiceMessageInputT,
): Promise<SendServiceMessageResponseT> {
  const conversation = await loadOwnedConversation(ctx, conversationId);

  if (!isWindowOpen(conversation.lastInboundAt, new Date())) {
    throw DomainErrors.conflict(
      "La ventana de 24 horas está cerrada. Usa una plantilla para escribir.",
    );
  }

  if (!conversation.phoneNumber) {
    throw DomainErrors.validation(
      "La conversación no tiene un teléfono de destino válido.",
    );
  }

  const phoneNumberId = await phoneNumberIdOf(
    ctx.db,
    conversation.whatsappConnectionId,
  );
  if (!phoneNumberId) {
    throw DomainErrors.conflict("El número de WhatsApp no está disponible.");
  }

  const outbound = toOutboundMessage(conversation.phoneNumber, input);

  // Eco OPTIMISTA (experimental): publica a otros agentes ANTES de esperar a
  // Kapso, con estado "sending" (relojito). El `clientMessageId` es temporal; el
  // settle posterior lo reemplaza por el WAMID real. Para texto `input.text` es
  // el cuerpo; para media, el caption (espejo de `toOutboundMessage`).
  const isText = input.type === "text";
  const clientMessageId = crypto.randomUUID();
  const optimisticAt = new Date();
  const optimisticMsg = outboundMessageDto({
    wamid: clientMessageId,
    type: input.type,
    text: isText ? input.text : null,
    caption: isText ? null : input.text,
    mediaUrl: input.mediaUrl ?? null,
    filename: input.filename ?? null,
    at: optimisticAt,
    status: "sending",
  });
  await safePublish(ctx, convChannel(conversation.id), {
    type: "message.new",
    conversationId: conversation.id,
    at: optimisticAt.toISOString(),
    message: optimisticMsg,
  });

  let result: { messageId: string | null };
  try {
    result = await sendMessage(phoneNumberId, outbound);
  } catch (err) {
    ctx.logger.error("[inbox] fallo enviando mensaje de servicio", {
      conversationId,
      type: input.type,
      error: err instanceof Error ? err.message : String(err),
    });
    // Revierte el eco optimista en otros agentes (quita la burbuja con relojito).
    await safePublish(ctx, convChannel(conversation.id), {
      type: "message.failed",
      conversationId: conversation.id,
      replacesClientId: clientMessageId,
      at: new Date().toISOString(),
    });
    throw DomainErrors.conflict(
      "No se pudo enviar el mensaje. Inténtalo de nuevo.",
    );
  }

  const now = new Date();
  const preview = previewOf(input.type, input.text ?? null);
  await ctx.db
    .update(schema.conversation)
    .set({
      lastMessageText: preview,
      lastMessageType: input.type,
      lastMessageAt: now,
      lastOutboundAt: now,
      unreadCount: 0,
      updatedAt: now,
    })
    .where(eq(schema.conversation.id, conversation.id));

  if (result.messageId) {
    await recordMessageUsage(ctx.db, {
      organizationId: ctx.currentOrg.id,
      wamid: result.messageId,
      direction: "outbound",
    });
  }

  // Settle: Kapso confirmó. Reemplaza la burbuja optimista por la real con el
  // WAMID (clave de dedup contra el read-through) y estado "sent" (primer check).
  const settled = outboundMessageDto({
    wamid: result.messageId ?? clientMessageId,
    type: input.type,
    text: isText ? input.text : null,
    caption: isText ? null : input.text,
    mediaUrl: input.mediaUrl ?? null,
    filename: input.filename ?? null,
    at: optimisticAt,
    status: "sent",
  });
  await safePublish(ctx, convChannel(conversation.id), {
    type: "message.new",
    conversationId: conversation.id,
    at: new Date().toISOString(),
    message: settled,
    replacesClientId: clientMessageId,
  });
  // La lista (preview/reorden) se revalida tras el commit en BD.
  await safePublish(ctx, orgChannel(ctx.currentOrg.id), {
    type: "conversation.upsert",
    conversationId: conversation.id,
    at: new Date().toISOString(),
  });

  const dto = await loadConversationDto(ctx, conversation.id);
  // El `wamid` (cuando Kapso lo confirma) viaja en la respuesta para que el
  // cliente reconcilie su eco optimista con el mensaje real por id.
  return { ...dto, wamid: result.messageId };
}

/**
 * Genera una URL firmada para subir media directo del navegador a R2 (design
 * D10). El miembro ya está autorizado por el middleware de la ruta. Traduce los
 * errores de configuración/validación de R2 a errores de dominio.
 */
export async function createUpload(
  _ctx: TenantServiceContext,
  input: PresignUploadInputT,
): Promise<PresignUploadResponseT> {
  try {
    return await createPresignedUpload({
      contentType: input.contentType,
      size: input.size,
      filename: input.filename ?? null,
    });
  } catch (err) {
    if (err instanceof R2Error) {
      throw DomainErrors.validation(err.message);
    }
    throw err;
  }
}

// ── Mensajes interactivos (Fase 5) ────────────────────────────────────────────

/** Construye el objeto `interactive` de Meta a partir del input del composer. */
function buildInteractive(input: SendInteractiveInputT): InteractivePayload {
  const interactive: Record<string, unknown> = {
    type: input.interactiveType,
    body: { text: input.bodyText },
  };
  if (input.headerText) {
    interactive.header = { type: "text", text: input.headerText };
  }
  if (input.footerText) {
    interactive.footer = { text: input.footerText };
  }

  if (input.interactiveType === "button") {
    interactive.action = {
      buttons: (input.buttons ?? []).map((b) => ({
        type: "reply",
        reply: { id: b.id, title: b.title },
      })),
    };
  } else if (input.interactiveType === "list") {
    interactive.action = {
      button: input.buttonLabel,
      sections: (input.sections ?? []).map((s) => ({
        ...(s.title ? { title: s.title } : {}),
        rows: s.rows.map((r) => ({
          id: r.id,
          title: r.title,
          ...(r.description ? { description: r.description } : {}),
        })),
      })),
    };
  } else {
    interactive.action = {
      name: "cta_url",
      parameters: { display_text: input.ctaDisplayText, url: input.ctaUrl },
    };
  }

  return interactive;
}

/**
 * Envía un mensaje interactivo (botones / lista / CTA URL). Es un mensaje de
 * servicio: sujeto a la ventana de 24h (fuera de ella, plantilla). Mide el uso
 * saliente.
 */
export async function sendInteractiveMessage(
  ctx: TenantServiceContext,
  conversationId: string,
  input: SendInteractiveInputT,
): Promise<ConversationDtoT> {
  const conversation = await loadOwnedConversation(ctx, conversationId);

  if (!isWindowOpen(conversation.lastInboundAt, new Date())) {
    throw DomainErrors.conflict(
      "La ventana de 24 horas está cerrada. Usa una plantilla para escribir.",
    );
  }
  if (!conversation.phoneNumber) {
    throw DomainErrors.validation(
      "La conversación no tiene un teléfono de destino válido.",
    );
  }

  const phoneNumberId = await phoneNumberIdOf(
    ctx.db,
    conversation.whatsappConnectionId,
  );
  if (!phoneNumberId) {
    throw DomainErrors.conflict("El número de WhatsApp no está disponible.");
  }

  let result: { messageId: string | null };
  try {
    result = await sendInteractive(phoneNumberId, {
      to: conversation.phoneNumber,
      interactive: buildInteractive(input),
    });
  } catch (err) {
    ctx.logger.error("[inbox] fallo enviando mensaje interactivo", {
      conversationId,
      type: input.interactiveType,
      error: err instanceof Error ? err.message : String(err),
    });
    throw DomainErrors.conflict(
      "No se pudo enviar el mensaje. Inténtalo de nuevo.",
    );
  }

  const now = new Date();
  await ctx.db
    .update(schema.conversation)
    .set({
      lastMessageText: previewOf("interactive", input.bodyText),
      lastMessageType: "interactive",
      lastMessageAt: now,
      lastOutboundAt: now,
      unreadCount: 0,
      updatedAt: now,
    })
    .where(eq(schema.conversation.id, conversation.id));

  if (result.messageId) {
    await recordMessageUsage(ctx.db, {
      organizationId: ctx.currentOrg.id,
      wamid: result.messageId,
      direction: "outbound",
    });
  }

  const echo = result.messageId
    ? outboundMessageDto({
        wamid: result.messageId,
        type: "interactive",
        text: input.bodyText,
        at: now,
      })
    : null;
  await publishOutboundEcho(ctx, conversation.id, echo, now);

  return loadConversationDto(ctx, conversation.id);
}

// ── Plantillas + iniciar conversación (Fase 4) ────────────────────────────────

/** `phone_number_id` y `business_account_id` (WABA) de una conexión. */
async function connectionMeta(
  db: Db,
  connectionId: string,
): Promise<{ phoneNumberId: string | null; businessAccountId: string | null }> {
  const rows = await db
    .select({
      phoneNumberId: schema.whatsappConnection.phoneNumberId,
      businessAccountId: schema.whatsappConnection.businessAccountId,
    })
    .from(schema.whatsappConnection)
    .where(eq(schema.whatsappConnection.id, connectionId))
    .limit(1);
  return {
    phoneNumberId: rows[0]?.phoneNumberId ?? null,
    businessAccountId: rows[0]?.businessAccountId ?? null,
  };
}

/** Extrae las claves de variable (`{{nombre}}` o `{{1}}`) en orden, sin repetir. */
function parseVariables(text: string | null): string[] {
  if (!text) return [];
  const keys: string[] = [];
  const re = /\{\{\s*([^}]+?)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const key = m[1].trim();
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

/** Mapea una plantilla de Kapso al DTO del inbox (con variables y header). */
function toTemplateDto(t: KapsoTemplate): TemplateDtoT {
  const body = t.components.find((c) => c.type === "BODY") ?? null;
  const header = t.components.find((c) => c.type === "HEADER") ?? null;
  const headerFormat = (header?.format ?? null) as TemplateDtoT["headerFormat"];
  const headerText = headerFormat === "TEXT" ? (header?.text ?? null) : null;
  const bodyVariables = parseVariables(body?.text ?? null);
  const headerVariables = parseVariables(headerText);

  const declared = t.parameterFormat?.toUpperCase();
  const allKeys = [...bodyVariables, ...headerVariables];
  const inferredNamed = allKeys.some((k) => !/^\d+$/.test(k));
  const parameterFormat: "named" | "positional" =
    declared === "NAMED"
      ? "named"
      : declared === "POSITIONAL"
        ? "positional"
        : inferredNamed
          ? "named"
          : "positional";

  return {
    name: t.name,
    language: t.language,
    status: t.status,
    category: t.category,
    parameterFormat,
    bodyText: body?.text ?? null,
    headerFormat,
    headerText,
    bodyVariables,
    headerVariables,
  };
}

/**
 * Lista las plantillas de un número (lectura en vivo, sin caché). Sin `status`
 * devuelve TODAS con su estado (APPROVED/PENDING/REJECTED), para que el usuario
 * vea si están aprobadas sin entrar a Meta. El envío solo admite APPROVED.
 */
export async function listTemplates(
  ctx: TenantServiceContext,
  connectionId: string,
  status?: string,
): Promise<TemplateDtoT[]> {
  await assertConnectionOwned(ctx, connectionId);
  const { businessAccountId } = await connectionMeta(ctx.db, connectionId);
  if (!businessAccountId) {
    throw DomainErrors.conflict(
      "El número no tiene una cuenta de WhatsApp Business asociada.",
    );
  }
  const templates = await kapsoListTemplates(
    businessAccountId,
    status ? { status } : {},
  );
  return templates.map(toTemplateDto);
}

const MEDIA_HEADER_FORMATS = new Set(["IMAGE", "VIDEO", "DOCUMENT"]);

/** Construye los `components` del envío de plantilla a partir del DTO + input. */
function buildTemplateComponents(
  dto: TemplateDtoT,
  input: SendTemplateInputT,
): TemplateSendComponent[] {
  const named = dto.parameterFormat === "named";
  const components: TemplateSendComponent[] = [];

  const mapParams = (keys: string[], values: Record<string, string>) =>
    keys.map((key) =>
      named
        ? { type: "text", parameter_name: key, text: values[key] ?? "" }
        : { type: "text", text: values[key] ?? "" },
    );

  // Cabecera: media (link de R2) o texto con variables.
  if (dto.headerFormat && MEDIA_HEADER_FORMATS.has(dto.headerFormat)) {
    if (!input.headerMediaUrl) {
      throw DomainErrors.validation(
        "La plantilla requiere un archivo de cabecera.",
      );
    }
    const kind = dto.headerFormat.toLowerCase(); // image | video | document
    components.push({
      type: "header",
      parameters: [{ type: kind, [kind]: { link: input.headerMediaUrl } }],
    });
  } else if (dto.headerVariables.length > 0) {
    components.push({
      type: "header",
      parameters: mapParams(dto.headerVariables, input.headerVariables),
    });
  }

  if (dto.bodyVariables.length > 0) {
    components.push({
      type: "body",
      parameters: mapParams(dto.bodyVariables, input.bodyVariables),
    });
  }

  return components;
}

/** Sustituye las variables en el cuerpo para el preview de la lista. */
function renderBody(dto: TemplateDtoT, input: SendTemplateInputT): string {
  if (!dto.bodyText) return "[Plantilla]";
  return dto.bodyText.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_full, key: string) => {
    return input.bodyVariables[key.trim()] ?? _full;
  });
}

/**
 * Envía una plantilla a la conversación. Permitido SIEMPRE (también fuera de la
 * ventana de 24h). Re-lee la plantilla en vivo para construir los `components`
 * con el formato de variables correcto (named/positional). Mide el uso saliente.
 */
export async function sendTemplateMessage(
  ctx: TenantServiceContext,
  conversationId: string,
  input: SendTemplateInputT,
): Promise<ConversationDtoT> {
  const conversation = await loadOwnedConversation(ctx, conversationId);

  if (!conversation.phoneNumber) {
    throw DomainErrors.validation(
      "La conversación no tiene un teléfono de destino válido.",
    );
  }

  const { phoneNumberId, businessAccountId } = await connectionMeta(
    ctx.db,
    conversation.whatsappConnectionId,
  );
  if (!phoneNumberId || !businessAccountId) {
    throw DomainErrors.conflict("El número de WhatsApp no está disponible.");
  }

  const candidates = await kapsoListTemplates(businessAccountId, {
    name: input.templateName,
  });
  const match = candidates.find(
    (t) => t.name === input.templateName && t.language === input.language,
  );
  if (!match) {
    throw DomainErrors.notFound("Plantilla no encontrada.");
  }
  // Solo las aprobadas son enviables; Meta rechaza el resto.
  if ((match.status ?? "").toUpperCase() !== "APPROVED") {
    throw DomainErrors.conflict(
      "La plantilla aún no está aprobada por WhatsApp y no se puede enviar.",
    );
  }
  const dto = toTemplateDto(match);
  const components = buildTemplateComponents(dto, input);

  let result: { messageId: string | null };
  try {
    result = await sendTemplate(phoneNumberId, {
      to: conversation.phoneNumber,
      name: input.templateName,
      language: input.language,
      components,
    });
  } catch (err) {
    ctx.logger.error("[inbox] fallo enviando plantilla", {
      conversationId,
      template: input.templateName,
      error: err instanceof Error ? err.message : String(err),
    });
    throw DomainErrors.conflict(
      "No se pudo enviar la plantilla. Inténtalo de nuevo.",
    );
  }

  const now = new Date();
  await ctx.db
    .update(schema.conversation)
    .set({
      lastMessageText: previewOf("template", renderBody(dto, input)),
      lastMessageType: "template",
      lastMessageAt: now,
      lastOutboundAt: now,
      unreadCount: 0,
      updatedAt: now,
    })
    .where(eq(schema.conversation.id, conversation.id));

  if (result.messageId) {
    await recordMessageUsage(ctx.db, {
      organizationId: ctx.currentOrg.id,
      wamid: result.messageId,
      direction: "outbound",
    });
  }

  const echo = result.messageId
    ? outboundMessageDto({
        wamid: result.messageId,
        type: "template",
        text: renderBody(dto, input),
        at: now,
      })
    : null;
  await publishOutboundEcho(ctx, conversation.id, echo, now);

  return loadConversationDto(ctx, conversation.id);
}

/**
 * Inicia (o recupera) una conversación desde un contacto/teléfono. Crea la fila
 * proactiva del índice (sin `kapso_conversation_id`) si no existe. Aplica la
 * regla de Meta: `kind=service` exige ventana abierta; si no, hay que usar
 * plantilla (la conversación proactiva nueva nunca tiene ventana abierta).
 */
export async function startConversation(
  ctx: TenantServiceContext,
  input: StartConversationInputT,
): Promise<ConversationDtoT> {
  await assertConnectionOwned(ctx, input.connectionId);

  let contactId: string | null = null;
  let phone: string | null = null;

  if (input.contactId) {
    const rows = await ctx.db
      .select({ id: schema.contact.id, phone: schema.contact.phone })
      .from(schema.contact)
      .where(
        and(
          eq(schema.contact.id, input.contactId),
          eq(schema.contact.organizationId, ctx.currentOrg.id),
        ),
      )
      .limit(1);
    if (!rows[0]) throw DomainErrors.notFound("Contacto no encontrado.");
    contactId = rows[0].id;
    phone = rows[0].phone;
  } else if (input.phone) {
    phone = normalizePhone(
      input.phone.startsWith("+") ? input.phone : `+${input.phone}`,
    );
    if (!phone) throw DomainErrors.validation("Teléfono no válido.");
    contactId = await resolveOrCreateContact(
      ctx.db,
      ctx.currentOrg.id,
      phone,
      null,
    );
  }

  if (!phone) throw DomainErrors.validation("Indica un contacto o un teléfono.");

  const existing = await ctx.db
    .select()
    .from(schema.conversation)
    .where(
      and(
        eq(schema.conversation.organizationId, ctx.currentOrg.id),
        eq(schema.conversation.whatsappConnectionId, input.connectionId),
        eq(schema.conversation.phoneNumber, phone),
      ),
    )
    .limit(1);

  const lastInboundAt = existing[0]?.lastInboundAt ?? null;
  if (input.kind === "service" && !isWindowOpen(lastInboundAt, new Date())) {
    throw DomainErrors.conflict(
      "La ventana de 24 horas está cerrada. Inicia con una plantilla.",
    );
  }

  if (existing[0]) {
    return loadConversationDto(ctx, existing[0].id);
  }

  const id = crypto.randomUUID();
  await ctx.db.insert(schema.conversation).values({
    id,
    organizationId: ctx.currentOrg.id,
    whatsappConnectionId: input.connectionId,
    contactId,
    kapsoConversationId: null,
    phoneNumber: phone,
    notifyStatus: "abierta",
    assignedUserId: null,
    unreadCount: 0,
  });

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

export type InboxWebhookDeps = {
  db: Db;
  logger: Logger;
  /** Puerto de realtime; no-op si Centrífugo no está configurado (design D1/D2). */
  realtime: RealtimePublisher;
};

/**
 * Publica un evento de realtime best-effort tras un commit. Cualquier fallo se
 * registra y se traga: NO debe propagarse (design D2). El adaptador ya captura
 * sus propios errores; este try/catch es una salvaguarda extra del puerto (p. ej.
 * una implementación que sí lance). Acepta tanto los `deps` del webhook como el
 * `ctx` de las rutas (ambos exponen `realtime` + `logger`).
 */
async function safePublish(
  source: { realtime: RealtimePublisher; logger: Logger },
  channel: string,
  data: unknown,
): Promise<void> {
  try {
    await source.realtime.publish(channel, data);
  } catch (err) {
    source.logger.warn("[inbox] publish de realtime falló", {
      channel,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Construye un `MessageDto` saliente para enriquecer el payload del realtime, de
 * modo que OTROS agentes rendericen el mensaje al instante sin esperar el
 * read-through. El `id` es el WAMID: así dedup-a contra el mensaje real del hilo
 * y contra el eco optimista del emisor (reconciliación por `wamid`).
 */
function outboundMessageDto(params: {
  wamid: string;
  type: string;
  text?: string | null;
  caption?: string | null;
  mediaUrl?: string | null;
  filename?: string | null;
  at: Date;
  /** "sending" (relojito) para el eco optimista; "sent" (primer check) al settle. */
  status?: string;
}): MessageDtoT {
  return {
    id: params.wamid,
    type: params.type,
    direction: "outbound",
    status: params.status ?? "sent",
    timestamp: params.at.toISOString(),
    text: params.text ?? null,
    caption: params.caption ?? null,
    mediaUrl: params.mediaUrl ?? null,
    mediaContentType: null,
    filename: params.filename ?? null,
    transcript: null,
    replyToId: null,
  };
}

/**
 * Eco inmediato de un saliente (task 4.4): publica tras enviar para que OTROS
 * agentes de la org vean el mensaje sin esperar el webhook `message.sent`. El
 * payload va enriquecido con el `MessageDto` (si hay WAMID) para render directo;
 * el cliente igualmente revalida para reconciliar. Best-effort vía `safePublish`.
 */
async function publishOutboundEcho(
  ctx: TenantServiceContext,
  conversationId: string,
  message: MessageDtoT | null,
  at: Date,
): Promise<void> {
  await safePublish(ctx, convChannel(conversationId), {
    type: "message.new",
    conversationId,
    wamid: message?.id ?? null,
    messageType: message?.type ?? null,
    at: at.toISOString(),
    ...(message ? { message } : {}),
  });
  await safePublish(ctx, orgChannel(ctx.currentOrg.id), {
    type: "conversation.upsert",
    conversationId,
    at: at.toISOString(),
  });
}

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
  let existing = existingRows[0];

  // Adopción: si no hay fila por kapso_conversation_id pero existe una proactiva
  // (creada por `startConversation`, sin id de Kapso) para el mismo número y
  // teléfono, se reutiliza en vez de duplicar. Se enlaza con su id de Kapso.
  if (!existing && phone) {
    const normalized = normalizePhone(
      phone.startsWith("+") ? phone : `+${phone}`,
    );
    if (normalized) {
      const proactive = await deps.db
        .select()
        .from(schema.conversation)
        .where(
          and(
            eq(schema.conversation.whatsappConnectionId, connection.id),
            eq(schema.conversation.phoneNumber, normalized),
            isNull(schema.conversation.kapsoConversationId),
          ),
        )
        .limit(1);
      existing = proactive[0];
    }
  }

  const newWindow = opensNewWindow(existing?.lastInboundAt ?? null, ts);

  let conversationId: string;

  if (existing) {
    conversationId = existing.id;
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
        // Adopta el id de Kapso si la fila era proactiva (sin él).
        kapsoConversationId: existing.kapsoConversationId ?? kapsoConversationId,
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
    conversationId = crypto.randomUUID();
    await deps.db.insert(schema.conversation).values({
      id: conversationId,
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

  // Realtime tras el commit (design D2/D4): la lista de la org se revalida
  // (conversation.upsert) y, si la conversación está abierta, su hilo (message.new).
  // El payload del hilo va enriquecido con el `MessageDto` (si hay WAMID) para
  // render directo; el cliente igualmente revalida (media inbound se resuelve por
  // read-through, así que `mediaUrl` llega null y se completa al reconciliar).
  const inboundMessage: MessageDtoT | null = wamid
    ? {
        id: wamid,
        type,
        direction: "inbound",
        status: null,
        timestamp: ts.toISOString(),
        text,
        caption: null,
        mediaUrl: null,
        mediaContentType: null,
        filename: null,
        transcript: null,
        replyToId: null,
      }
    : null;

  await safePublish(deps, orgChannel(orgId), {
    type: "conversation.upsert",
    conversationId,
    at: ts.toISOString(),
  });
  await safePublish(deps, convChannel(conversationId), {
    type: "message.new",
    conversationId,
    wamid,
    messageType: type,
    at: ts.toISOString(),
    ...(inboundMessage ? { message: inboundMessage } : {}),
  });
}

/** Error de entrega tal como lo entrega Meta/Kapso (subset tolerante). */
type DeliveryError = {
  code?: number | string | null;
  title?: string | null;
  message?: string | null;
  error_data?: { details?: string | null } | null;
};

/** Payload de `whatsapp.message.sent|delivered|read|failed`. */
export type DeliveryStatusPayload = {
  message?: {
    id?: string | null;
    kapso?: {
      status?: string | null;
      conversation_id?: string | null;
      whatsapp_conversation_id?: string | null;
      errors?: DeliveryError[] | null;
    } | null;
    errors?: DeliveryError[] | null;
  } | null;
  status?: string | null;
  errors?: DeliveryError[] | null;
  phone_number_id?: string | null;
};

/** Extrae un motivo de fallo legible del payload (o null si no hay). */
function failureReasonOf(payload: DeliveryStatusPayload): string | null {
  const errors =
    payload.message?.errors ?? payload.message?.kapso?.errors ?? payload.errors;
  const first = errors?.[0];
  if (!first) return null;
  const detail = first.error_data?.details ?? first.message ?? first.title ?? null;
  const code = first.code != null ? `[${first.code}] ` : "";
  return detail ? `${code}${detail}` : code || null;
}

/**
 * Refleja el estado de entrega de un saliente (`sent|delivered|read|failed`).
 *
 * Arquitectura híbrida (design D1): NO hay tabla de mensajes local, así que el
 * estado por mensaje se refleja por read-through (Kapso lo expone en
 * `message.kapso.status`). Aquí registramos la transición para trazabilidad y,
 * en `failed`, el motivo del error (requisito de "indicar fallos con su
 * motivo"). El `failed` se registra como warning para visibilidad operativa.
 */
export async function ingestDeliveryStatus(
  deps: InboxWebhookDeps,
  payload: DeliveryStatusPayload,
): Promise<void> {
  const wamid = payload.message?.id ?? null;
  const status = payload.message?.kapso?.status ?? payload.status ?? null;
  const reason = status === "failed" ? failureReasonOf(payload) : null;

  if (status === "failed") {
    deps.logger.warn("[inbox-webhook] mensaje saliente fallido", {
      wamid,
      status,
      reason,
    });
  } else {
    deps.logger.info("[inbox-webhook] estado de entrega", { wamid, status });
  }

  // Realtime (design D4): el estado por mensaje se refleja por read-through, pero
  // empujamos una señal `delivery.update` al hilo para que el cliente revalide sin
  // esperar el poll. Resolvemos la conversación local por su id de Kapso.
  const kapsoConversationId =
    payload.message?.kapso?.conversation_id ??
    payload.message?.kapso?.whatsapp_conversation_id ??
    null;
  if (!kapsoConversationId) return;

  const rows = await deps.db
    .select({
      id: schema.conversation.id,
      organizationId: schema.conversation.organizationId,
    })
    .from(schema.conversation)
    .where(eq(schema.conversation.kapsoConversationId, kapsoConversationId))
    .limit(1);
  const conversation = rows[0];
  if (!conversation) return;

  await safePublish(deps, convChannel(conversation.id), {
    type: "delivery.update",
    conversationId: conversation.id,
    wamid,
    status,
    reason,
  });
}

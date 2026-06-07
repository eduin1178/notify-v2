/**
 * Cliente fino y tipado para la Kapso Platform API (`/platform/v1`).
 *
 * Cubre SOLO la capa de plataforma usada para conectar cuentas (customers,
 * setup_links, phone_numbers). La mensajería va por el proxy de Meta y el SDK
 * `@kapso/whatsapp-cloud-api`, fuera del alcance de este módulo.
 *
 * Autenticación: header `X-API-Key` con la `KAPSO_API_KEY` de plataforma.
 * No es un módulo de servicios: lo consume `lib/services/whatsapp`. Aun así
 * no importa `next/*`, `hono`, `@hono/*` ni `web/app/**`.
 */

import { env } from "@/lib/env";

const PLATFORM_BASE = `${env.KAPSO_API_BASE_URL}/platform/v1`;
// Proxy de Meta (mensajería/contactos): base distinta de la Platform API e
// incluye la versión de la Graph API. Doc Kapso: base
// `https://api.kapso.ai/meta/whatsapp/v24.0`.
const META_GRAPH_VERSION = "v24.0";
const META_BASE = `${env.KAPSO_API_BASE_URL}/meta/whatsapp/${META_GRAPH_VERSION}`;

export type KapsoConnectionType = "coexistence" | "dedicated";

export type CreateCustomerInput = {
  /** Id externo estable; usamos el `organizationId` de Notify para idempotencia. */
  externalCustomerId: string;
  name: string;
};

export type KapsoCustomer = {
  id: string;
  name: string | null;
  externalCustomerId: string | null;
};

export type CreateSetupLinkInput = {
  successRedirectUrl: string;
  failureRedirectUrl: string;
  allowedConnectionTypes: KapsoConnectionType[];
  /** ISO 639-1; el proyecto usa "es". */
  language?: string;
  /** Para reconexión: fija el número existente; fuerza provision=false en Kapso. */
  reconnectPhoneNumber?: string;
};

export type KapsoSetupLink = {
  id: string;
  status: string;
  url: string;
  expiresAt: string | null;
};

/** Número de WhatsApp tal como lo conoce Kapso (subset usado por Notify). */
export type KapsoPhoneNumber = {
  /** Meta phone number ID — el identificador rey. */
  phoneNumberId: string;
  businessAccountId: string | null;
  displayPhoneNumber: string | null;
  /** Nombre de negocio verificado por Meta (preferido para identificar). */
  verifiedName: string | null;
  /** Nombre visible al cliente (custom en Kapso). */
  displayName: string | null;
  /** Etiqueta interna del número en Kapso. */
  name: string | null;
  /** true = coexistence (WhatsApp Business App); false = dedicated. */
  isCoexistence: boolean | null;
  /** Estado de conexión de Meta (p. ej. "CONNECTED"). */
  status: string | null;
  /** Customer de Kapso dueño del número; null si no está asignado. */
  customerId: string | null;
};

/** Error de transporte/HTTP de Kapso. El servicio decide cómo traducirlo a dominio. */
export class KapsoApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string, message?: string) {
    super(message ?? `Kapso API respondió ${status}`);
    this.name = "KapsoApiError";
    this.status = status;
    this.body = body;
  }
}

type DataEnvelope<T> = { data: T };

type RawCustomer = {
  id: string;
  name?: string | null;
  external_customer_id?: string | null;
};

type RawSetupLink = {
  id: string;
  status?: string | null;
  url: string;
  expires_at?: string | null;
};

type RawPhoneNumber = {
  id: string;
  phone_number_id?: string | null;
  business_account_id?: string | null;
  display_phone_number?: string | null;
  verified_name?: string | null;
  display_name?: string | null;
  name?: string | null;
  is_coexistence?: boolean | null;
  status?: string | null;
  customer_id?: string | null;
};

function toPhoneNumber(raw: RawPhoneNumber): KapsoPhoneNumber {
  return {
    phoneNumberId: raw.phone_number_id ?? raw.id,
    businessAccountId: raw.business_account_id ?? null,
    displayPhoneNumber: raw.display_phone_number ?? null,
    verifiedName: raw.verified_name ?? null,
    displayName: raw.display_name ?? null,
    name: raw.name ?? null,
    isCoexistence: raw.is_coexistence ?? null,
    status: raw.status ?? null,
    customerId: raw.customer_id ?? null,
  };
}

async function requestUrl<T>(
  url: string,
  init: { method: string; body?: unknown },
): Promise<T> {
  const res = await fetch(url, {
    method: init.method,
    headers: {
      "X-API-Key": env.KAPSO_API_KEY,
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    // Llamada servidor→servidor: nunca cachear.
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new KapsoApiError(res.status, text);
  }

  // 204 No Content (p. ej. DELETE) no trae cuerpo.
  if (res.status === 204) return undefined as T;

  return (await res.json()) as T;
}

/** Request contra la Platform API (`/platform/v1`). */
async function request<T>(
  path: string,
  init: { method: string; body?: unknown },
): Promise<T> {
  return requestUrl<T>(`${PLATFORM_BASE}${path}`, init);
}

/** POST /platform/v1/customers */
export async function createCustomer(
  input: CreateCustomerInput,
): Promise<KapsoCustomer> {
  const res = await request<DataEnvelope<RawCustomer>>("/customers", {
    method: "POST",
    body: {
      customer: {
        name: input.name,
        external_customer_id: input.externalCustomerId,
      },
    },
  });
  return {
    id: res.data.id,
    name: res.data.name ?? null,
    externalCustomerId: res.data.external_customer_id ?? null,
  };
}

/** POST /platform/v1/customers/:id/setup_links */
export async function createSetupLink(
  customerId: string,
  input: CreateSetupLinkInput,
): Promise<KapsoSetupLink> {
  const res = await request<DataEnvelope<RawSetupLink>>(
    `/customers/${encodeURIComponent(customerId)}/setup_links`,
    {
      method: "POST",
      body: {
        setup_link: {
          success_redirect_url: input.successRedirectUrl,
          failure_redirect_url: input.failureRedirectUrl,
          allowed_connection_types: input.allowedConnectionTypes,
          ...(input.language ? { language: input.language } : {}),
          ...(input.reconnectPhoneNumber
            ? { reconnect_phone_number: input.reconnectPhoneNumber }
            : {}),
        },
      },
    },
  );
  return {
    id: res.data.id,
    status: res.data.status ?? "active",
    url: res.data.url,
    expiresAt: res.data.expires_at ?? null,
  };
}

/** GET /platform/v1/whatsapp/phone_numbers?customer_id=:id (lista por customer) */
export async function listPhoneNumbers(
  customerId: string,
): Promise<KapsoPhoneNumber[]> {
  const res = await request<DataEnvelope<RawPhoneNumber[]>>(
    `/whatsapp/phone_numbers?customer_id=${encodeURIComponent(customerId)}&per_page=100`,
    { method: "GET" },
  );
  return res.data.map(toPhoneNumber);
}

/** GET /platform/v1/whatsapp/phone_numbers/:phone_number_id */
export async function getPhoneNumber(
  phoneNumberId: string,
): Promise<KapsoPhoneNumber> {
  const res = await request<DataEnvelope<RawPhoneNumber>>(
    `/whatsapp/phone_numbers/${encodeURIComponent(phoneNumberId)}`,
    { method: "GET" },
  );
  return toPhoneNumber(res.data);
}

/** DELETE /platform/v1/whatsapp/phone_numbers/:phone_number_id (204) */
export async function deletePhoneNumber(phoneNumberId: string): Promise<void> {
  await request<void>(
    `/whatsapp/phone_numbers/${encodeURIComponent(phoneNumberId)}`,
    { method: "DELETE" },
  );
}

/**
 * Contacto de WhatsApp tal como lo expone Kapso (proxy de Meta). `waId` (E.164)
 * puede ser null cuando Meta solo provee identidad por BSUID.
 */
export type KapsoContact = {
  waId: string | null;
  profileName: string | null;
  displayName: string | null;
  businessScopedUserId: string | null;
};

export type KapsoContactsPage = {
  contacts: KapsoContact[];
  /** Cursor de la página siguiente; null si no hay más resultados. */
  nextCursor: string | null;
};

type RawContact = {
  id: string;
  wa_id?: string | null;
  profile_name?: string | null;
  display_name?: string | null;
  business_scoped_user_id?: string | null;
};

type RawContactsPage = {
  data: RawContact[];
  paging?: {
    cursors?: { after?: string | null; before?: string | null };
    next?: string | null;
  };
};

/**
 * GET /meta/whatsapp/:phone_number_id/contacts — UNA página, scopeada al número.
 * Paginación por cursor (`after`, `limit`≤100). Devuelve `nextCursor=null`
 * cuando no hay más resultados.
 */
export async function listWhatsappContacts(
  phoneNumberId: string,
  options: { after?: string; limit?: number } = {},
): Promise<KapsoContactsPage> {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 100));
  if (options.after) params.set("after", options.after);

  const url = `${META_BASE}/${encodeURIComponent(phoneNumberId)}/contacts?${params.toString()}`;
  const res = await requestUrl<RawContactsPage>(url, { method: "GET" });

  const contacts = (res.data ?? []).map((c) => ({
    waId: c.wa_id ?? null,
    profileName: c.profile_name ?? null,
    displayName: c.display_name ?? null,
    businessScopedUserId: c.business_scoped_user_id ?? null,
  }));

  // Solo hay más páginas si esta trajo resultados y Kapso entregó cursor `after`.
  const after = res.paging?.cursors?.after ?? null;
  const nextCursor = contacts.length > 0 ? after : null;

  return { contacts, nextCursor };
}

// ── Inbox: conversaciones y mensajes (Platform API v1) ───────────────────────
// El inbox usa la arquitectura híbrida (ver change add-inbox, design D1): el
// ÍNDICE de conversaciones vive en Notify, pero el CONTENIDO (mensajes y media)
// se lee de Kapso por read-through con estas funciones.

/** Metadatos de conversación que Kapso adjunta bajo `kapso`. */
type RawConversationKapso = {
  contact_name?: string | null;
  messages_count?: number | null;
  last_message_id?: string | null;
  last_message_type?: string | null;
  last_message_timestamp?: string | null;
  last_message_text?: string | null;
  last_inbound_at?: string | null;
  last_outbound_at?: string | null;
};

type RawConversation = {
  id: string;
  status?: string | null;
  phone_number?: string | null;
  phone_number_id?: string | null;
  last_active_at?: string | null;
  created_at?: string | null;
  kapso?: RawConversationKapso | null;
};

/** Conversación de Kapso (subset usado por Notify para backfill/reconciliación). */
export type KapsoConversation = {
  id: string;
  status: string | null;
  phoneNumber: string | null;
  phoneNumberId: string | null;
  contactName: string | null;
  lastMessageText: string | null;
  lastMessageType: string | null;
  lastMessageAt: string | null;
  lastInboundAt: string | null;
};

export type KapsoConversationsPage = {
  conversations: KapsoConversation[];
  nextCursor: string | null;
};

type RawConversationsResponse = {
  data: RawConversation[];
  paging?: { cursors?: { after?: string | null; before?: string | null } };
};

function toConversation(raw: RawConversation): KapsoConversation {
  const k = raw.kapso ?? {};
  return {
    id: raw.id,
    status: raw.status ?? null,
    phoneNumber: raw.phone_number ?? null,
    phoneNumberId: raw.phone_number_id ?? null,
    contactName: k.contact_name ?? null,
    lastMessageText: k.last_message_text ?? null,
    lastMessageType: k.last_message_type ?? null,
    lastMessageAt: k.last_message_timestamp ?? raw.last_active_at ?? null,
    lastInboundAt: k.last_inbound_at ?? null,
  };
}

/**
 * GET /platform/v1/whatsapp/conversations — UNA página, acotada al número.
 * Ordena por actividad reciente; paginación por cursor (`after`, `limit`≤100).
 */
export async function listConversations(options: {
  phoneNumberId: string;
  status?: "active" | "ended";
  phoneNumber?: string;
  after?: string;
  limit?: number;
}): Promise<KapsoConversationsPage> {
  const params = new URLSearchParams();
  params.set("phone_number_id", options.phoneNumberId);
  params.set("limit", String(options.limit ?? 50));
  if (options.status) params.set("status", options.status);
  if (options.phoneNumber) params.set("phone_number", options.phoneNumber);
  if (options.after) params.set("after", options.after);

  const res = await request<RawConversationsResponse>(
    `/whatsapp/conversations?${params.toString()}`,
    { method: "GET" },
  );

  const conversations = (res.data ?? []).map(toConversation);
  const after = res.paging?.cursors?.after ?? null;
  return {
    conversations,
    nextCursor: conversations.length > 0 ? after : null,
  };
}

type RawMessage = {
  id: string;
  timestamp?: string | null;
  type?: string | null;
  kapso?: {
    direction?: string | null;
    status?: string | null;
    whatsapp_conversation_id?: string | null;
    content?: string | null;
    has_media?: boolean | null;
    media_url?: string | null;
    media_data?: {
      url?: string | null;
      filename?: string | null;
      content_type?: string | null;
    } | null;
    transcript?: { text?: string | null } | null;
    contact_name?: string | null;
  } | null;
  text?: { body?: string | null } | null;
  image?: { link?: string | null; caption?: string | null } | null;
  video?: { link?: string | null; caption?: string | null } | null;
  audio?: { link?: string | null } | null;
  document?: {
    link?: string | null;
    filename?: string | null;
    caption?: string | null;
  } | null;
  // Respuesta del cliente a un mensaje interactivo entrante.
  button?: { text?: string | null; payload?: string | null } | null;
  interactive?: {
    type?: string | null;
    button_reply?: { id?: string | null; title?: string | null } | null;
    list_reply?: { id?: string | null; title?: string | null } | null;
  } | null;
  context?: { id?: string | null } | null;
};

/** Mensaje de WhatsApp (subset Meta + extensiones Kapso) usado por el hilo. */
export type KapsoMessage = {
  id: string;
  type: string;
  direction: "inbound" | "outbound";
  status: string | null;
  timestamp: string | null;
  /** Texto o contenido legible del mensaje. */
  text: string | null;
  /** Pie de foto/caption para media. */
  caption: string | null;
  /** URL del media alojada por Kapso (read-through; no se duplica). */
  mediaUrl: string | null;
  mediaContentType: string | null;
  filename: string | null;
  transcript: string | null;
  /** WAMID del mensaje citado, si aplica. */
  replyToId: string | null;
};

export type KapsoMessagesPage = {
  messages: KapsoMessage[];
  /** Cursor de mensajes MÁS ANTIGUOS (la lista viene newest-first). */
  nextCursor: string | null;
};

type RawMessagesResponse = {
  data: RawMessage[];
  paging?: { cursors?: { after?: string | null; before?: string | null } };
};

function toMessage(raw: RawMessage): KapsoMessage {
  const k = raw.kapso ?? {};
  const type = raw.type ?? "text";
  const caption =
    raw.image?.caption ?? raw.video?.caption ?? raw.document?.caption ?? null;
  // Respuesta interactiva entrante: el título elegido por el cliente.
  const interactiveReply =
    raw.button?.text ??
    raw.interactive?.button_reply?.title ??
    raw.interactive?.list_reply?.title ??
    null;
  const text = raw.text?.body ?? interactiveReply ?? k.content ?? null;
  const mediaUrl =
    k.media_url ??
    k.media_data?.url ??
    raw.image?.link ??
    raw.video?.link ??
    raw.audio?.link ??
    raw.document?.link ??
    null;
  const ts = raw.timestamp
    ? new Date(Number(raw.timestamp) * 1000).toISOString()
    : null;
  return {
    id: raw.id,
    type,
    direction: k.direction === "outbound" ? "outbound" : "inbound",
    status: k.status ?? null,
    timestamp: ts,
    text,
    caption,
    mediaUrl,
    mediaContentType: k.media_data?.content_type ?? null,
    filename: raw.document?.filename ?? k.media_data?.filename ?? null,
    transcript: k.transcript?.text ?? null,
    replyToId: raw.context?.id ?? null,
  };
}

/**
 * GET /platform/v1/whatsapp/messages — historial de UNA conversación
 * (newest-first), paginación por cursor. `after` trae mensajes más antiguos.
 */
export async function listMessages(options: {
  conversationId: string;
  after?: string;
  limit?: number;
}): Promise<KapsoMessagesPage> {
  const params = new URLSearchParams();
  params.set("conversation_id", options.conversationId);
  params.set("limit", String(options.limit ?? 50));
  if (options.after) params.set("after", options.after);

  const res = await request<RawMessagesResponse>(
    `/whatsapp/messages?${params.toString()}`,
    { method: "GET" },
  );

  const messages = (res.data ?? []).map(toMessage);
  const after = res.paging?.cursors?.after ?? null;
  return {
    messages,
    nextCursor: messages.length > 0 ? after : null,
  };
}

/**
 * Mensaje saliente de servicio (texto o media por `link`). El media ya vive en
 * una URL pública (R2, design D10); aquí solo se referencia por `link`.
 */
export type OutboundMessage =
  | { type: "text"; to: string; text: string }
  | { type: "image"; to: string; link: string; caption?: string | null }
  | { type: "video"; to: string; link: string; caption?: string | null }
  | { type: "audio"; to: string; link: string }
  | {
      type: "document";
      to: string;
      link: string;
      filename?: string | null;
      caption?: string | null;
    };

type RawSendResponse = { messages?: { id?: string | null }[] | null };

/** Normaliza el destinatario al formato de Meta (dígitos, sin `+`). */
function toRecipient(to: string): string {
  return to.replace(/[^\d]/g, "");
}

function toMetaBody(msg: OutboundMessage): Record<string, unknown> {
  const base = { messaging_product: "whatsapp", to: toRecipient(msg.to) };
  switch (msg.type) {
    case "text":
      return { ...base, type: "text", text: { body: msg.text } };
    case "image":
      return {
        ...base,
        type: "image",
        image: { link: msg.link, ...(msg.caption ? { caption: msg.caption } : {}) },
      };
    case "video":
      return {
        ...base,
        type: "video",
        video: { link: msg.link, ...(msg.caption ? { caption: msg.caption } : {}) },
      };
    case "audio":
      return { ...base, type: "audio", audio: { link: msg.link } };
    case "document":
      return {
        ...base,
        type: "document",
        document: {
          link: msg.link,
          ...(msg.filename ? { filename: msg.filename } : {}),
          ...(msg.caption ? { caption: msg.caption } : {}),
        },
      };
  }
}

/**
 * Envía un mensaje de servicio vía el proxy de Meta de Kapso.
 * POST /meta/whatsapp/:phone_number_id/messages. Devuelve el WAMID del mensaje
 * creado (o null si Kapso no lo expone). La ventana de 24h la valida el dominio.
 */
export async function sendMessage(
  phoneNumberId: string,
  msg: OutboundMessage,
): Promise<{ messageId: string | null }> {
  const url = `${META_BASE}/${encodeURIComponent(phoneNumberId)}/messages`;
  const res = await requestUrl<RawSendResponse>(url, {
    method: "POST",
    body: toMetaBody(msg),
  });
  return { messageId: res.messages?.[0]?.id ?? null };
}

// ── Plantillas (Meta proxy) ──────────────────────────────────────────────────
// Las plantillas se listan por WABA (`business_account_id`) y se envían por
// número (`phone_number_id`). Lectura en vivo (sin caché, design Fase 4).

type RawTemplateComponent = {
  type?: string | null;
  format?: string | null;
  text?: string | null;
};

type RawTemplate = {
  id?: string | null;
  name: string;
  language: string;
  status?: string | null;
  category?: string | null;
  parameter_format?: string | null;
  components?: RawTemplateComponent[] | null;
};

type RawTemplatesResponse = { data?: RawTemplate[] | null };

/** Componente de plantilla (subset usado para extraer variables y header). */
export type KapsoTemplateComponent = {
  /** HEADER | BODY | FOOTER | BUTTONS */
  type: string;
  /** Para HEADER: TEXT | IMAGE | VIDEO | DOCUMENT | LOCATION. */
  format: string | null;
  text: string | null;
};

/** Plantilla aprobada de WhatsApp (subset usado por el inbox). */
export type KapsoTemplate = {
  id: string | null;
  name: string;
  language: string;
  status: string | null;
  category: string | null;
  /** NAMED | POSITIONAL (formato de variables). */
  parameterFormat: string | null;
  components: KapsoTemplateComponent[];
};

/**
 * GET /meta/whatsapp/:business_account_id/message_templates — plantillas del
 * WABA. Sin `status` devuelve TODAS (con su estado APPROVED/PENDING/REJECTED),
 * para que el usuario vea el estado de sus plantillas. Solo las APPROVED son
 * enviables (lo valida el dominio).
 */
export async function listTemplates(
  businessAccountId: string,
  options: { status?: string; name?: string; limit?: number } = {},
): Promise<KapsoTemplate[]> {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 100));
  if (options.status) params.set("status", options.status);
  if (options.name) params.set("name", options.name);

  const url = `${META_BASE}/${encodeURIComponent(businessAccountId)}/message_templates?${params.toString()}`;
  const res = await requestUrl<RawTemplatesResponse>(url, { method: "GET" });

  return (res.data ?? []).map((t) => ({
    id: t.id ?? null,
    name: t.name,
    language: t.language,
    status: t.status ?? null,
    category: t.category ?? null,
    parameterFormat: t.parameter_format ?? null,
    components: (t.components ?? []).map((c) => ({
      type: (c.type ?? "").toUpperCase(),
      format: c.format ? c.format.toUpperCase() : null,
      text: c.text ?? null,
    })),
  }));
}

/** Componente del envío de plantilla (estructura Meta ya construida). */
export type TemplateSendComponent = Record<string, unknown>;

/**
 * Envía una plantilla vía el proxy de Meta. Permitido fuera de la ventana de
 * 24h (las plantillas no están sujetas a la ventana de servicio).
 */
export async function sendTemplate(
  phoneNumberId: string,
  payload: {
    to: string;
    name: string;
    language: string;
    components: TemplateSendComponent[];
  },
): Promise<{ messageId: string | null }> {
  const url = `${META_BASE}/${encodeURIComponent(phoneNumberId)}/messages`;
  const res = await requestUrl<RawSendResponse>(url, {
    method: "POST",
    body: {
      messaging_product: "whatsapp",
      to: toRecipient(payload.to),
      type: "template",
      template: {
        name: payload.name,
        language: { code: payload.language },
        ...(payload.components.length > 0
          ? { components: payload.components }
          : {}),
      },
    },
  });
  return { messageId: res.messages?.[0]?.id ?? null };
}

/** Objeto `interactive` de Meta ya construido por el dominio. */
export type InteractivePayload = Record<string, unknown>;

/**
 * Envía un mensaje interactivo (botones / lista / CTA URL) vía el proxy de Meta.
 * Sujeto a la ventana de 24h (lo valida el dominio).
 */
export async function sendInteractive(
  phoneNumberId: string,
  payload: { to: string; interactive: InteractivePayload },
): Promise<{ messageId: string | null }> {
  const url = `${META_BASE}/${encodeURIComponent(phoneNumberId)}/messages`;
  const res = await requestUrl<RawSendResponse>(url, {
    method: "POST",
    body: {
      messaging_product: "whatsapp",
      to: toRecipient(payload.to),
      type: "interactive",
      interactive: payload.interactive,
    },
  });
  return { messageId: res.messages?.[0]?.id ?? null };
}

/**
 * Marca un mensaje entrante como leído (✓✓ azul) vía el proxy de Meta.
 * POST /meta/whatsapp/:phone_number_id/messages { status: "read", message_id }.
 */
export async function markMessageRead(
  phoneNumberId: string,
  messageId: string,
): Promise<void> {
  const url = `${META_BASE}/${encodeURIComponent(phoneNumberId)}/messages`;
  await requestUrl<unknown>(url, {
    method: "POST",
    body: {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    },
  });
}

/** Eventos de mensaje/conversación que el inbox necesita recibir por webhook. */
const INBOX_WEBHOOK_EVENTS = [
  "whatsapp.message.received",
  "whatsapp.message.sent",
  "whatsapp.message.delivered",
  "whatsapp.message.read",
  "whatsapp.message.failed",
  "whatsapp.conversation.created",
  "whatsapp.conversation.ended",
  "whatsapp.conversation.inactive",
] as const;

type RawWebhook = { id: string; url?: string | null; kind?: string | null };
type RawWebhooksResponse = { data?: RawWebhook[] };

/**
 * Garantiza (idempotente) que el número tenga un webhook number-scoped `kapso`
 * SIN buffering apuntando a `webhookUrl`, suscrito a los eventos del inbox.
 * Si ya existe uno con la misma URL, no crea otro.
 */
export async function ensureMessageWebhook(
  phoneNumberId: string,
  webhookUrl: string,
): Promise<void> {
  const base = `/whatsapp/phone_numbers/${encodeURIComponent(phoneNumberId)}/webhooks`;

  const existing = await request<RawWebhooksResponse>(base, {
    method: "GET",
  }).catch(() => ({ data: [] }) as RawWebhooksResponse);

  if ((existing.data ?? []).some((w) => w.url === webhookUrl)) return;

  await request<DataEnvelope<RawWebhook>>(base, {
    method: "POST",
    body: {
      whatsapp_webhook: {
        url: webhookUrl,
        kind: "kapso",
        secret_key: env.KAPSO_WEBHOOK_SECRET,
        active: true,
        buffer_enabled: false,
        events: [...INBOX_WEBHOOK_EVENTS],
        payload_version: "v2",
      },
    },
  });
}

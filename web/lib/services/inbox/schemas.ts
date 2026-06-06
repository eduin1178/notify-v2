import { z } from "zod";

/** Estados de negocio propios de Notify (independientes de Kapso). */
export const NotifyStatus = z.enum(["abierta", "pendiente", "cerrada"]);

/** Comportamiento de reapertura ante un entrante en conversación cerrada. */
export const ReopenBehavior = z.enum([
  "reopen_keep_agent",
  "reopen_unassign",
  "stay_closed",
]);

export const ConversationIdParam = z.object({
  id: z.string().min(1),
});

/** Número de WhatsApp seleccionable en el inbox (conexión `connected`). */
export const InboxNumberDto = z.object({
  /** id de la conexión (whatsapp_connection). */
  connectionId: z.string(),
  phoneNumberId: z.string().nullable(),
  displayPhoneNumber: z.string().nullable(),
  name: z.string().nullable(),
});

export const InboxNumbersResponse = z.object({
  numbers: z.array(InboxNumberDto),
});

/** Agente asignado (subset del usuario Notify). */
export const AssignedUserDto = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
});

/** Contacto enlazado (subset). */
export const ConversationContactDto = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  phone: z.string(),
});

/** Fila del índice de conversaciones (lo que pinta la lista, sin llamar a Kapso). */
export const ConversationDto = z.object({
  id: z.string(),
  kapsoConversationId: z.string().nullable(),
  connectionId: z.string(),
  phoneNumber: z.string().nullable(),
  contact: ConversationContactDto.nullable(),
  notifyStatus: NotifyStatus,
  assignedUser: AssignedUserDto.nullable(),
  lastInboundAt: z.string().datetime().nullable(),
  lastMessageAt: z.string().datetime().nullable(),
  lastMessageText: z.string().nullable(),
  lastMessageType: z.string().nullable(),
  unreadCount: z.number().int(),
  /** Derivado de la ventana de 24h (last_inbound_at + 24h). */
  windowOpen: z.boolean(),
  windowClosesAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/** Filtro de asignación de la bandeja. */
export const AssignmentFilter = z.enum(["all", "mine", "unassigned", "others"]);

export const ListConversationsQuery = z.object({
  /** Selector de número (req #6): el inbox muestra siempre UN número. */
  connectionId: z.string().min(1),
  status: NotifyStatus.optional(),
  assignment: AssignmentFilter.default("all"),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export const ConversationListResponse = z.object({
  items: z.array(ConversationDto),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

/** Mensaje del hilo (read-through desde Kapso). */
export const MessageDto = z.object({
  id: z.string(),
  type: z.string(),
  direction: z.enum(["inbound", "outbound"]),
  status: z.string().nullable(),
  timestamp: z.string().datetime().nullable(),
  text: z.string().nullable(),
  caption: z.string().nullable(),
  mediaUrl: z.string().nullable(),
  mediaContentType: z.string().nullable(),
  filename: z.string().nullable(),
  transcript: z.string().nullable(),
  replyToId: z.string().nullable(),
});

export const MessageThreadQuery = z.object({
  after: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const MessageThreadResponse = z.object({
  /** Newest-first (tal como los entrega Kapso); la UI los invierte para pintar. */
  items: z.array(MessageDto),
  nextCursor: z.string().nullable(),
});

// ── Gestión (Fase 2) ─────────────────────────────────────────────────────────

export const ConnectionIdParam = z.object({
  connectionId: z.string().min(1),
});

/** Cambio de estado de negocio de una conversación. */
export const UpdateStatusInput = z.object({
  status: NotifyStatus,
});

/** Asignación de una conversación a un agente (null = desasignar). */
export const AssignInput = z.object({
  userId: z.string().min(1).nullable(),
});

/** Configuración del inbox por número. */
export const InboxSettingsDto = z.object({
  connectionId: z.string(),
  reopenBehavior: ReopenBehavior,
  sendReadReceipts: z.boolean(),
});

/** Reemplazo completo de la configuración por número (PUT). */
export const UpdateInboxSettingsInput = z.object({
  reopenBehavior: ReopenBehavior,
  sendReadReceipts: z.boolean(),
});

export type NotifyStatusT = z.infer<typeof NotifyStatus>;
export type ReopenBehaviorT = z.infer<typeof ReopenBehavior>;
export type InboxNumberDtoT = z.infer<typeof InboxNumberDto>;
export type AssignedUserDtoT = z.infer<typeof AssignedUserDto>;
export type ConversationContactDtoT = z.infer<typeof ConversationContactDto>;
export type ConversationDtoT = z.infer<typeof ConversationDto>;
export type AssignmentFilterT = z.infer<typeof AssignmentFilter>;
export type ListConversationsQueryT = z.infer<typeof ListConversationsQuery>;
export type ConversationListResponseT = z.infer<typeof ConversationListResponse>;
export type MessageDtoT = z.infer<typeof MessageDto>;
export type MessageThreadQueryT = z.infer<typeof MessageThreadQuery>;
export type MessageThreadResponseT = z.infer<typeof MessageThreadResponse>;
export type UpdateStatusInputT = z.infer<typeof UpdateStatusInput>;
export type AssignInputT = z.infer<typeof AssignInput>;
export type InboxSettingsDtoT = z.infer<typeof InboxSettingsDto>;
export type UpdateInboxSettingsInputT = z.infer<typeof UpdateInboxSettingsInput>;

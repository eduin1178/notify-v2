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

// ── Envío de servicio + media (Fase 3) ───────────────────────────────────────

/** Tipos de mensaje de servicio que el composer puede enviar. */
export const ServiceMessageType = z.enum([
  "text",
  "image",
  "video",
  "audio",
  "document",
]);

/** Categoría de media admitida para subida directa a R2. */
export const MediaCategory = z.enum(["image", "video", "audio", "document"]);

/**
 * Mensaje de servicio a enviar. `text` es el cuerpo (type=text) o el pie de
 * foto/caption (media). `mediaUrl` es obligatorio para todo tipo no-texto y
 * debe ser una URL pública (ya subida a R2).
 */
export const SendServiceMessageInput = z
  .object({
    type: ServiceMessageType,
    text: z.string().trim().max(4096).optional(),
    mediaUrl: z.string().url().optional(),
    filename: z.string().trim().max(255).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.type === "text") {
      if (!val.text || val.text.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["text"],
          message: "El texto es obligatorio.",
        });
      }
    } else if (!val.mediaUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mediaUrl"],
        message: "El archivo es obligatorio para este tipo de mensaje.",
      });
    }
  });

/** Solicitud de URL firmada para subir un archivo directo a R2. */
export const PresignUploadInput = z.object({
  contentType: z.string().min(1).max(255),
  size: z.number().int().positive(),
  filename: z.string().max(255).optional(),
});

export const PresignUploadResponse = z.object({
  uploadUrl: z.string().url(),
  publicUrl: z.string().url(),
  category: MediaCategory,
});

// ── Plantillas + iniciar conversación (Fase 4) ────────────────────────────────

/** Formato de cabecera de la plantilla. */
export const TemplateHeaderFormat = z.enum([
  "TEXT",
  "IMAGE",
  "VIDEO",
  "DOCUMENT",
  "LOCATION",
]);

/**
 * Plantilla aprobada lista para enviar. `bodyVariables`/`headerVariables` son
 * las claves de variable (nombres si NAMED; índices "1","2"… si POSITIONAL).
 */
export const TemplateDto = z.object({
  name: z.string(),
  language: z.string(),
  status: z.string().nullable(),
  category: z.string().nullable(),
  parameterFormat: z.enum(["named", "positional"]),
  bodyText: z.string().nullable(),
  headerFormat: TemplateHeaderFormat.nullable(),
  headerText: z.string().nullable(),
  bodyVariables: z.array(z.string()),
  headerVariables: z.array(z.string()),
});

export const TemplatesResponse = z.object({
  templates: z.array(TemplateDto),
});

/** Estado de aprobación de una plantilla en Meta. */
export const TemplateStatus = z.enum(["APPROVED", "PENDING", "REJECTED"]);

/** Filtro opcional por estado al listar plantillas. */
export const TemplatesQuery = z.object({
  status: TemplateStatus.optional(),
});

/** Envío de una plantilla con variables y, si aplica, media de cabecera. */
export const SendTemplateInput = z.object({
  templateName: z.string().min(1),
  language: z.string().min(1),
  bodyVariables: z.record(z.string(), z.string()).default({}),
  headerVariables: z.record(z.string(), z.string()).default({}),
  /** URL pública (R2) para cabeceras de imagen/video/documento. */
  headerMediaUrl: z.string().url().optional(),
});

/** Inicio de conversación desde un contacto (proactivo o con ventana abierta). */
export const StartConversationInput = z
  .object({
    connectionId: z.string().min(1),
    contactId: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
    /** `service` exige ventana abierta; `template` siempre permitido. */
    kind: z.enum(["service", "template"]).default("template"),
  })
  .superRefine((val, ctx) => {
    if (!val.contactId && !val.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contactId"],
        message: "Indica un contacto o un teléfono.",
      });
    }
  });

// ── Mensajes interactivos (Fase 5) ───────────────────────────────────────────

/** Botón de respuesta (máx. 3 por mensaje). `title` ≤ 20 caracteres (Meta). */
export const InteractiveButton = z.object({
  id: z.string().trim().min(1).max(256),
  title: z.string().trim().min(1).max(20),
});

/** Fila de una lista. `title` ≤ 24, `description` ≤ 72 (Meta). */
export const InteractiveRow = z.object({
  id: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(24),
  description: z.string().trim().max(72).optional(),
});

export const InteractiveSection = z.object({
  title: z.string().trim().max(24).optional(),
  rows: z.array(InteractiveRow).min(1).max(10),
});

/**
 * Mensaje interactivo a enviar: botones de respuesta, lista o CTA URL. Sujeto a
 * la ventana de 24h. Los campos requeridos dependen de `interactiveType`.
 */
export const SendInteractiveInput = z
  .object({
    interactiveType: z.enum(["button", "list", "cta_url"]),
    bodyText: z.string().trim().min(1).max(1024),
    headerText: z.string().trim().max(60).optional(),
    footerText: z.string().trim().max(60).optional(),
    // type=button
    buttons: z.array(InteractiveButton).min(1).max(3).optional(),
    // type=list
    buttonLabel: z.string().trim().max(20).optional(),
    sections: z.array(InteractiveSection).min(1).max(10).optional(),
    // type=cta_url
    ctaDisplayText: z.string().trim().min(1).max(20).optional(),
    ctaUrl: z.string().url().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.interactiveType === "button") {
      if (!val.buttons || val.buttons.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["buttons"],
          message: "Agrega al menos un botón.",
        });
      }
    } else if (val.interactiveType === "list") {
      if (!val.buttonLabel) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["buttonLabel"],
          message: "Indica el texto del botón de la lista.",
        });
      }
      const totalRows = (val.sections ?? []).reduce(
        (acc, s) => acc + s.rows.length,
        0,
      );
      if (totalRows === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sections"],
          message: "Agrega al menos una opción a la lista.",
        });
      }
      if (totalRows > 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sections"],
          message: "La lista admite como máximo 10 opciones.",
        });
      }
    } else if (val.interactiveType === "cta_url") {
      if (!val.ctaDisplayText || !val.ctaUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ctaUrl"],
          message: "Indica el texto y la URL del botón.",
        });
      }
    }
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
export type ServiceMessageTypeT = z.infer<typeof ServiceMessageType>;
export type MediaCategoryT = z.infer<typeof MediaCategory>;
export type SendServiceMessageInputT = z.infer<typeof SendServiceMessageInput>;
export type PresignUploadInputT = z.infer<typeof PresignUploadInput>;
export type PresignUploadResponseT = z.infer<typeof PresignUploadResponse>;
export type TemplateHeaderFormatT = z.infer<typeof TemplateHeaderFormat>;
export type TemplateDtoT = z.infer<typeof TemplateDto>;
export type TemplatesResponseT = z.infer<typeof TemplatesResponse>;
export type TemplateStatusT = z.infer<typeof TemplateStatus>;
export type TemplatesQueryT = z.infer<typeof TemplatesQuery>;
export type SendTemplateInputT = z.infer<typeof SendTemplateInput>;
export type StartConversationInputT = z.infer<typeof StartConversationInput>;
export type InteractiveButtonT = z.infer<typeof InteractiveButton>;
export type InteractiveRowT = z.infer<typeof InteractiveRow>;
export type InteractiveSectionT = z.infer<typeof InteractiveSection>;
export type SendInteractiveInputT = z.infer<typeof SendInteractiveInput>;

import { z } from "zod";

/** Estados del ciclo de vida de una conexión de WhatsApp. */
export const WhatsappConnectionStatus = z.enum([
  "pending",
  "connected",
  "disconnected",
  "needs_reconnect",
  "failed",
]);

export const ConnectionIdParam = z.object({
  id: z.string().min(1),
});

export const WhatsappConnectionDto = z.object({
  id: z.string(),
  status: WhatsappConnectionStatus,
  phoneNumberId: z.string().nullable(),
  displayPhoneNumber: z.string().nullable(),
  businessAccountId: z.string().nullable(),
  connectionType: z.enum(["coexistence", "dedicated"]).nullable(),
  connectedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const WhatsappConnectionsResponse = z.object({
  connections: z.array(WhatsappConnectionDto),
});

/** Respuesta al generar (o regenerar) un setup link. */
export const SetupLinkResponse = z.object({
  connectionId: z.string(),
  url: z.string().url(),
  setupLinkId: z.string(),
  expiresAt: z.string().datetime().nullable(),
});

export type WhatsappConnectionStatusT = z.infer<typeof WhatsappConnectionStatus>;
export type ConnectionIdParamT = z.infer<typeof ConnectionIdParam>;
export type WhatsappConnectionDtoT = z.infer<typeof WhatsappConnectionDto>;
export type WhatsappConnectionsResponseT = z.infer<
  typeof WhatsappConnectionsResponse
>;
export type SetupLinkResponseT = z.infer<typeof SetupLinkResponse>;

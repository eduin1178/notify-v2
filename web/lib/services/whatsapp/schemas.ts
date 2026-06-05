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
  name: z.string().nullable(),
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

/**
 * Número que existe en Kapso (bajo el customer de la org) pero aún NO está en
 * Notify. Candidato a importación/reconciliación manual.
 */
export const ImportablePhoneNumberDto = z.object({
  phoneNumberId: z.string(),
  name: z.string().nullable(),
  displayPhoneNumber: z.string().nullable(),
  businessAccountId: z.string().nullable(),
  connectionType: z.enum(["coexistence", "dedicated"]).nullable(),
  status: z.string().nullable(),
});

export const ImportablePhoneNumbersResponse = z.object({
  numbers: z.array(ImportablePhoneNumberDto),
});

/** Input para importar un número existente de Kapso a Notify. */
export const ImportPhoneNumberInput = z.object({
  phoneNumberId: z.string().min(1),
});

/** Input para renombrar una conexión (etiqueta editable por el usuario). */
export const RenameConnectionInput = z.object({
  name: z.string().trim().min(1, "El nombre no puede estar vacío.").max(60),
});

export type WhatsappConnectionStatusT = z.infer<typeof WhatsappConnectionStatus>;
export type ConnectionIdParamT = z.infer<typeof ConnectionIdParam>;
export type WhatsappConnectionDtoT = z.infer<typeof WhatsappConnectionDto>;
export type WhatsappConnectionsResponseT = z.infer<
  typeof WhatsappConnectionsResponse
>;
export type SetupLinkResponseT = z.infer<typeof SetupLinkResponse>;
export type ImportablePhoneNumberDtoT = z.infer<typeof ImportablePhoneNumberDto>;
export type ImportablePhoneNumbersResponseT = z.infer<
  typeof ImportablePhoneNumbersResponse
>;
export type ImportPhoneNumberInputT = z.infer<typeof ImportPhoneNumberInput>;
export type RenameConnectionInputT = z.infer<typeof RenameConnectionInput>;

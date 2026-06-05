import { z } from "zod";

import { isValidPhone } from "@/lib/services/contacts/phone";

export const ContactIdParam = z.object({
  id: z.string().min(1),
});

/** Representación de salida de un contacto. */
export const ContactDto = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  phone: z.string(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  company: z.string().nullable(),
  source: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const phoneField = z
  .string()
  .trim()
  .min(1, "El teléfono es obligatorio.")
  .refine(
    isValidPhone,
    "Ingresa un teléfono válido en formato internacional, por ejemplo +573001234567.",
  );

const emailField = z
  .string()
  .trim()
  .max(160)
  .email("Ingresa un correo electrónico válido.")
  .optional()
  .or(z.literal(""));

const optionalText = z.string().trim().max(200).optional().or(z.literal(""));

/**
 * Input del formulario manual. Validación ESTRICTA: nombres, apellidos y
 * teléfono obligatorios (el apellido solo es obligatorio en este camino; en
 * importaciones puede quedar vacío — ver `last_name` nullable en el schema).
 */
export const CreateContactInput = z.object({
  firstName: z.string().trim().min(1, "Los nombres son obligatorios.").max(120),
  lastName: z.string().trim().min(1, "Los apellidos son obligatorios.").max(120),
  phone: phoneField,
  email: emailField,
  address: optionalText,
  city: optionalText,
  company: optionalText,
});

/** El formulario de edición envía el registro completo (PATCH de reemplazo). */
export const UpdateContactInput = CreateContactInput;

export const ListContactsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const PaginatedContactsResponse = z.object({
  items: z.array(ContactDto),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export type ContactIdParamT = z.infer<typeof ContactIdParam>;
export type ContactDtoT = z.infer<typeof ContactDto>;
export type CreateContactInputT = z.infer<typeof CreateContactInput>;
export type UpdateContactInputT = z.infer<typeof UpdateContactInput>;
export type ListContactsQueryT = z.infer<typeof ListContactsQuery>;
export type PaginatedContactsResponseT = z.infer<typeof PaginatedContactsResponse>;

import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),

  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET debe tener al menos 32 caracteres"),
  BETTER_AUTH_URL: z.string().url(),

  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),

  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().min(1),

  SUPER_ADMIN_EMAIL: z
    .string()
    .email()
    .optional()
    .transform((v) => (v ? v.trim().toLowerCase() : undefined)),

  // Kapso (BSP de WhatsApp). KAPSO_API_BASE_URL es el host, sin `/platform/v1`.
  KAPSO_API_KEY: z.string().min(1),
  KAPSO_API_BASE_URL: z.string().url().default("https://api.kapso.ai"),
  // Secreto para verificar la firma HMAC SHA256 de los webhooks de Kapso.
  KAPSO_WEBHOOK_SECRET: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Variables de entorno inválidas o faltantes:\n${issues}`);
}

export const env = parsed.data;

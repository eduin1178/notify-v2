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

  // Cloudflare R2 (almacenamiento de media saliente, design D10). Opcionales:
  // la app arranca sin ellas; el envío de media valida su presencia al usarse.
  // El media saliente se sube directo del navegador a R2 por URL firmada y se
  // envía a Kapso por `link` (sortea el límite de body de Vercel).
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET: z.string().min(1).optional(),
  // URL pública base del bucket (dominio R2 o dominio propio) para el `link`.
  R2_PUBLIC_BASE_URL: z.string().url().optional(),

  // Centrífugo (realtime del inbox, change inbox-realtime-centrifugo). Opcionales:
  // la app arranca sin ellas y el inbox degrada a polling de respaldo. El realtime
  // se activa solo si están presentes. El HMAC debe coincidir con
  // `client.token.hmac_secret_key` y la API key con `http_api.key` del servidor
  // desplegado (ver infra/centrifugo/README.md).
  // Server-side (publicación + firmado de tokens):
  CENTRIFUGO_API_URL: z.string().url().optional(),
  CENTRIFUGO_API_KEY: z.string().min(1).optional(),
  CENTRIFUGO_TOKEN_HMAC_SECRET: z.string().min(1).optional(),
  // Cliente (va al navegador): URL del WebSocket de Centrífugo.
  NEXT_PUBLIC_CENTRIFUGO_WS_URL: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Variables de entorno inválidas o faltantes:\n${issues}`);
}

export const env = parsed.data;

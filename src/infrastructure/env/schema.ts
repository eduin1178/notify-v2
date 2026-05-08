import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  ENCRYPTION_KEY_V1: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, {
      message: "ENCRYPTION_KEY_V1 must decode to 32 bytes",
    }),
  NODE_ENV: z.enum(["development", "test", "production"]),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(
  source: Record<string, string | undefined> = process.env,
): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment variables:\n${issues}\n\nCheck .env.example for the expected shape.`,
    );
  }
  return result.data;
}

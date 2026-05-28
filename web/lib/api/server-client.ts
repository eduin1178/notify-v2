import { headers } from "next/headers";

import { createApiClient } from "@/lib/api/client";
import { env } from "@/lib/env";

/**
 * Construye un cliente REST tipado para uso desde Server Components / Server Actions.
 *
 * Reenvía la cookie de sesión actual al backend mediante `headers()` para que
 * `better-auth` la resuelva. Mismo proceso = baja latencia, sin red real cuando
 * el runtime lo permite (Node en Vercel hace hop interno).
 */
export async function getServerApiClient() {
  const headerList = await headers();
  const cookie = headerList.get("cookie") ?? "";

  const baseUrl = env.BETTER_AUTH_URL;

  return createApiClient(baseUrl, {
    headers: cookie ? { cookie } : undefined,
  });
}

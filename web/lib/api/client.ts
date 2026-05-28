import { hc } from "hono/client";

import type { AppType } from "@/lib/api/app";

type ClientOptions = {
  headers?: Record<string, string>;
  fetch?: typeof fetch;
};

/**
 * Cliente REST tipado, construido sobre `hono/client` y `AppType`.
 *
 * Uso (Expo / browser):
 *   const api = createApiClient("https://tu-dominio")
 *   await api.api.v1.me.$get()
 *
 * Uso (web Server Component / Server Action):
 *   ver `web/lib/api/server-client.ts` (reenvía la cookie de sesión).
 */
export function createApiClient(baseUrl: string, options: ClientOptions = {}) {
  return hc<AppType>(baseUrl, options);
}

export type ApiClient = ReturnType<typeof createApiClient>;

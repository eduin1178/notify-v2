/**
 * Contexto explícito que cada función de servicio recibe como primer argumento.
 *
 * Regla de la capa: los servicios NO importan `next/*`, `hono`, `@hono/*` ni `web/app/**`,
 * y NO leen sesión, db o usuario actual desde singletons. Todo entra por `ctx`.
 */

import type { db as DbClient } from "@/lib/db/client";
import type { EntitlementsPort, UsagePort } from "@/lib/services/billing/ports";
import type { Logger } from "@/lib/services/logger";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: string | null;
};

export type CurrentOrganization = {
  id: string;
  name: string;
  slug: string;
};

export type ServiceContext = {
  db: typeof DbClient;
  currentUser: CurrentUser;
  currentOrg?: CurrentOrganization;
  logger: Logger;
};

export type TenantServiceContext = ServiceContext & {
  currentOrg: CurrentOrganization;
  /** Costura de billing ligada a la organización activa (ver lib/services/billing). */
  entitlements: EntitlementsPort;
  usage: UsagePort;
};

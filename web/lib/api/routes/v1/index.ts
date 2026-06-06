import { OpenAPIHono } from "@hono/zod-openapi";

import type { HonoEnv } from "@/lib/api/context";
import { meRouter } from "@/lib/api/routes/v1/me";
import { contactsRouter } from "@/lib/api/routes/v1/orgs/contacts";
import { contactsCsvRouter } from "@/lib/api/routes/v1/orgs/contacts-csv";
import { getOrgRouter } from "@/lib/api/routes/v1/orgs/get-org";
import { inboxRouter } from "@/lib/api/routes/v1/orgs/inbox";
import { listMembersRouter } from "@/lib/api/routes/v1/orgs/list-members";
import { tagsRouter } from "@/lib/api/routes/v1/orgs/tags";
import { whatsappConnectionsRouter } from "@/lib/api/routes/v1/orgs/whatsapp-connections";

export const v1Router = new OpenAPIHono<HonoEnv>()
  .route("/", meRouter)
  .route("/", getOrgRouter)
  .route("/", listMembersRouter)
  .route("/", whatsappConnectionsRouter)
  // CSV (rutas planas) ANTES del router OpenAPI: /contacts/export no debe
  // capturarse como /contacts/{id}.
  .route("/", contactsCsvRouter)
  .route("/", contactsRouter)
  .route("/", tagsRouter)
  .route("/", inboxRouter);

export type V1Router = typeof v1Router;

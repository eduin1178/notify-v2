import { OpenAPIHono } from "@hono/zod-openapi";

import type { HonoEnv } from "@/lib/api/context";
import { meRouter } from "@/lib/api/routes/v1/me";
import { getOrgRouter } from "@/lib/api/routes/v1/orgs/get-org";
import { listMembersRouter } from "@/lib/api/routes/v1/orgs/list-members";
import { whatsappConnectionsRouter } from "@/lib/api/routes/v1/orgs/whatsapp-connections";

export const v1Router = new OpenAPIHono<HonoEnv>()
  .route("/", meRouter)
  .route("/", getOrgRouter)
  .route("/", listMembersRouter)
  .route("/", whatsappConnectionsRouter);

export type V1Router = typeof v1Router;

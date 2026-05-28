import { createMiddleware } from "hono/factory";

import { auth } from "@/lib/auth";
import type { HonoEnv } from "@/lib/api/context";
import { DomainErrors } from "@/lib/services/errors";

export const requireSession = createMiddleware<HonoEnv>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    throw DomainErrors.unauthorized("Sesión requerida.");
  }

  c.set("session", session);
  c.set("user", {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image ?? null,
    role: (session.user as { role?: string | null }).role ?? null,
  });

  await next();
});

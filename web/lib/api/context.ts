import type { CurrentSession } from "@/lib/auth/session";
import type { CurrentOrganization, CurrentUser } from "@/lib/services/context";

export type HonoEnv = {
  Variables: {
    session: CurrentSession;
    user: CurrentUser;
    org?: CurrentOrganization;
  };
};

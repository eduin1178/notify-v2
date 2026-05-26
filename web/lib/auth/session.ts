import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "@/lib/auth";

export const getSession = cache(async () => {
  const headerList = await headers();
  return auth.api.getSession({ headers: headerList });
});

export type CurrentSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;

import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/guards";
import { destinationToPath, resolvePostAuthDestination } from "@/lib/auth/routing";

export const dynamic = "force-dynamic";

export default async function PostAuthPage() {
  const session = await requireSession();
  const destination = await resolvePostAuthDestination(session);
  redirect(destinationToPath(destination));
}

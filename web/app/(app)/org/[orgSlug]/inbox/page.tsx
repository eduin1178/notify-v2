import type { Metadata } from "next";

import { buildServerTenantServiceContext } from "@/lib/api/server-ctx";
import { loadOrgContext } from "@/lib/org/context";
import { listConversations, listNumbers } from "@/lib/services/inbox/service";
import { InboxClient } from "@/components/app/inbox-client";

export const metadata: Metadata = {
  title: "Inbox · Notify",
};

export const dynamic = "force-dynamic";

export default async function InboxPage({
  params,
}: PageProps<"/org/[orgSlug]/inbox">) {
  const { orgSlug } = await params;

  const ctx = await loadOrgContext(orgSlug);
  const svc = await buildServerTenantServiceContext(ctx.organization.id);

  const numbers = await listNumbers(svc);
  const initialConnectionId = numbers[0]?.connectionId ?? null;

  const initial = initialConnectionId
    ? await listConversations(svc, {
        connectionId: initialConnectionId,
        assignment: "all",
        page: 1,
        pageSize: 30,
      })
    : null;

  const canConfigure =
    ctx.isSuperAdmin || ctx.role === "owner" || ctx.role === "admin";

  return (
    <InboxClient
      orgId={ctx.organization.id}
      numbers={numbers}
      initialConnectionId={initialConnectionId}
      initialConversations={initial?.items ?? []}
      canConfigure={canConfigure}
    />
  );
}

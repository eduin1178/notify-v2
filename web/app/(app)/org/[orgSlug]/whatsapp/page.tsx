import type { Metadata } from "next";

import { WhatsappClient } from "@/components/app/whatsapp-client";
import { buildServerTenantServiceContext } from "@/lib/api/server-ctx";
import { can } from "@/lib/auth/permissions";
import { loadOrgContext } from "@/lib/org/context";
import { listConnections } from "@/lib/services/whatsapp/service";

export const metadata: Metadata = {
  title: "WhatsApp · Notify",
};

export const dynamic = "force-dynamic";

export default async function WhatsappPage({
  params,
}: PageProps<"/org/[orgSlug]/whatsapp">) {
  const { orgSlug } = await params;
  const ctx = await loadOrgContext(orgSlug);
  const svc = await buildServerTenantServiceContext(ctx.organization.id);

  const { connections } = await listConnections(svc);
  const canManage = can(
    { isSuperAdmin: ctx.isSuperAdmin, orgRole: ctx.role },
    "org.whatsapp.connect",
  );

  return (
    <WhatsappClient
      orgSlug={ctx.organization.slug}
      canManage={canManage}
      connections={connections}
    />
  );
}

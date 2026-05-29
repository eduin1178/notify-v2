import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrgBillingControls } from "@/components/super-admin/org-billing-controls";
import { buildServerServiceContext } from "@/lib/api/server-ctx";
import { getOrgBilling, listPlans } from "@/lib/services/billing/service";
import type {
  OrgBillingDtoT,
  PlanDtoT,
} from "@/lib/services/billing/schemas";
import { isDomainError } from "@/lib/services/errors";

export const metadata: Metadata = {
  title: "Organización · Plataforma · Notify",
};

export const dynamic = "force-dynamic";

export default async function SuperAdminOrganizationDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const ctx = await buildServerServiceContext();

  let billing: OrgBillingDtoT;
  let plans: PlanDtoT[];
  try {
    [billing, plans] = await Promise.all([getOrgBilling(ctx, orgId), listPlans(ctx)]);
  } catch (err) {
    // No revelar la existencia del recurso a quien no corresponde.
    if (isDomainError(err)) notFound();
    throw err;
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <Link
          href="/super-admin/organizations"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Organizaciones
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {billing.organizationName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Plan y límites de la organización. Esta gestión no genera cobros.
        </p>
      </div>

      <OrgBillingControls billing={billing} plans={plans} />
    </section>
  );
}

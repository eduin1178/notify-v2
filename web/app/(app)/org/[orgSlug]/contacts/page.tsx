import type { Metadata } from "next";

import { buildServerTenantServiceContext } from "@/lib/api/server-ctx";
import { loadOrgContext } from "@/lib/org/context";
import { ListContactsQuery } from "@/lib/services/contacts/schemas";
import { listContacts, listTags } from "@/lib/services/contacts/service";
import { ContactsClient } from "@/components/app/contacts-client";

export const metadata: Metadata = {
  title: "Contactos · Notify",
};

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  params,
  searchParams,
}: PageProps<"/org/[orgSlug]/contacts">) {
  const { orgSlug } = await params;
  const sp = await searchParams;

  const ctx = await loadOrgContext(orgSlug);
  const svc = await buildServerTenantServiceContext(ctx.organization.id);

  const parsedQuery = ListContactsQuery.safeParse({
    page: sp.page,
    pageSize: sp.pageSize,
    tagId: sp.tagId,
  });
  const query = parsedQuery.success
    ? parsedQuery.data
    : { page: 1, pageSize: 20 };

  const [result, availableTags] = await Promise.all([
    listContacts(svc, query),
    listTags(svc),
  ]);

  return (
    <ContactsClient
      orgSlug={ctx.organization.slug}
      contacts={result.items}
      page={result.page}
      pageSize={result.pageSize}
      total={result.total}
      availableTags={availableTags}
      activeTagId={query.tagId ?? null}
    />
  );
}

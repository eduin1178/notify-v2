import { eq } from "drizzle-orm";
import {
  AddressBookIcon,
  ChatCircleTextIcon,
  UsersIcon,
  WhatsappLogoIcon,
} from "@phosphor-icons/react/dist/ssr";

import { loadOrgContext } from "@/lib/org/context";
import { db } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";
import { AppShell } from "@/components/app/app-shell";

export default async function OrgLayout({
  children,
  params,
}: LayoutProps<"/org/[orgSlug]">) {
  const { orgSlug } = await params;
  const ctx = await loadOrgContext(orgSlug);

  const memberships = await db
    .select({
      id: schema.organization.id,
      name: schema.organization.name,
      slug: schema.organization.slug,
    })
    .from(schema.member)
    .innerJoin(
      schema.organization,
      eq(schema.member.organizationId, schema.organization.id),
    )
    .where(eq(schema.member.userId, ctx.session.user.id));

  const items = [
    {
      title: "Inbox",
      url: `/org/${ctx.organization.slug}/inbox`,
      icon: <ChatCircleTextIcon />,
    },
    {
      title: "Miembros",
      url: `/org/${ctx.organization.slug}/members`,
      icon: <UsersIcon />,
    },
    {
      title: "Contactos",
      url: `/org/${ctx.organization.slug}/contacts`,
      icon: <AddressBookIcon />,
    },
    {
      title: "WhatsApp",
      url: `/org/${ctx.organization.slug}/whatsapp`,
      icon: <WhatsappLogoIcon />,
    },
  ];

  return (
    <AppShell
      mode="org"
      user={{
        name: ctx.session.user.name,
        email: ctx.session.user.email,
        image: ctx.session.user.image,
        isSuperAdmin: ctx.isSuperAdmin,
      }}
      teams={memberships}
      activeTeamId={ctx.organization.id}
      items={items}
    >
      {children}
    </AppShell>
  );
}

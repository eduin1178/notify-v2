import type { Metadata } from "next";

import { requireSession } from "@/lib/auth/guards";
import { loadAccountInvitations } from "@/lib/account/load-invitations";
import { ConnectionsSection } from "@/components/account/connections-section";
import { InvitationsSection } from "@/components/account/invitations-section";
import { OrganizationsSection } from "@/components/account/organizations-section";
import { ProfileSection } from "@/components/account/profile-section";

export const metadata: Metadata = {
  title: "Mi cuenta · Notify",
};

export default async function AccountPage() {
  const session = await requireSession("/sign-in?redirect=/account");
  const invitations = await loadAccountInvitations(session.user.email);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mi cuenta</h1>
        <p className="text-sm text-muted-foreground">
          Gestiona tus datos, conexiones, organizaciones e invitaciones.
        </p>
      </header>

      <ProfileSection
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
          createdAt: session.user.createdAt,
        }}
      />
      <ConnectionsSection />
      <OrganizationsSection />
      <InvitationsSection data={invitations} />
    </div>
  );
}

import Link from "next/link";

import { OrgSwitcher } from "@/components/app/org-switcher";
import { UserMenu } from "@/components/app/user-menu";

type Props = {
  currentOrg: { id: string; name: string; slug: string };
  memberships: Array<{ id: string; name: string; slug: string }>;
  user: {
    name: string;
    email: string;
    image: string | null | undefined;
    isSuperAdmin: boolean;
  };
};

export function Topbar({ currentOrg, memberships, user }: Props) {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href={`/o/${currentOrg.slug}`} className="text-sm font-semibold">
            Notify
          </Link>
          <span aria-hidden className="text-muted-foreground">/</span>
          <OrgSwitcher currentOrg={currentOrg} memberships={memberships} />
        </div>

        <nav className="flex items-center gap-4 text-sm">
          <Link
            href={`/o/${currentOrg.slug}/members`}
            className="text-muted-foreground hover:text-foreground"
          >
            Miembros
          </Link>
          {user.isSuperAdmin ? (
            <Link
              href="/super-admin"
              className="text-muted-foreground hover:text-foreground"
            >
              Plataforma
            </Link>
          ) : null}
          <UserMenu user={user} />
        </nav>
      </div>
    </header>
  );
}

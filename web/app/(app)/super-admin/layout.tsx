import {
  BuildingsIcon,
  HouseIcon,
  UsersIcon,
} from "@phosphor-icons/react/dist/ssr";

import { requireSuperAdmin } from "@/lib/auth/guards";
import { AppShell } from "@/components/app/app-shell";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSuperAdmin();

  const items = [
    {
      title: "Organizaciones",
      url: "/super-admin/organizations",
      icon: <BuildingsIcon />,
    },
    {
      title: "Usuarios",
      url: "/super-admin/users",
      icon: <UsersIcon />,
    },
    {
      title: "Volver a la app",
      url: "/post-auth",
      icon: <HouseIcon />,
    },
  ];

  return (
    <AppShell
      mode="super-admin"
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        isSuperAdmin: true,
      }}
      items={items}
    >
      {children}
    </AppShell>
  );
}

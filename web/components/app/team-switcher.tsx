"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BuildingsIcon,
  CaretUpDownIcon,
  CheckIcon,
  PlusIcon,
} from "@phosphor-icons/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { organization } from "@/lib/auth/client";

export type TeamItem = {
  id: string;
  name: string;
  slug: string;
};

type Props = {
  teams: TeamItem[];
  activeTeamId: string;
};

export function TeamSwitcher({ teams, activeTeamId }: Props) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? teams[0];

  if (!activeTeam) return null;

  function handleSelect(team: TeamItem) {
    if (team.id === activeTeam!.id) return;
    startTransition(async () => {
      await organization.setActive({ organizationId: team.id });
      router.push(`/org/${team.slug}`);
      router.refresh();
    });
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              disabled={pending}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <BuildingsIcon weight="bold" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{activeTeam.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {activeTeam.slug}
                </span>
              </div>
              <CaretUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Tus organizaciones
            </DropdownMenuLabel>
            {teams.map((team) => {
              const isActive = team.id === activeTeam.id;
              return (
                <DropdownMenuItem
                  key={team.id}
                  onSelect={() => handleSelect(team)}
                  className="gap-2 p-2"
                >
                  <div className="flex size-6 items-center justify-center rounded-md border">
                    <BuildingsIcon className="size-4" />
                  </div>
                  <span className="flex-1 truncate">{team.name}</span>
                  {isActive ? <CheckIcon className="size-4" weight="bold" /> : null}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="gap-2 p-2">
              <Link href="/onboarding/new-org">
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <PlusIcon className="size-4" />
                </div>
                <span className="font-medium text-muted-foreground">
                  Crear organización
                </span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

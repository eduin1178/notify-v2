"use client";

import * as React from "react";
import Link from "next/link";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavMain, type NavMainItem } from "@/components/app/nav-main";
import { NavUser, type NavUserProps } from "@/components/app/nav-user";
import {
  TeamSwitcher,
  type TeamItem,
} from "@/components/app/team-switcher";
import {
  PlusIcon,
  ShieldStarIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";

type CommonProps = {
  user: NavUserProps["user"];
  items: NavMainItem[];
};

export type AppSidebarProps =
  | (CommonProps & {
      mode: "org";
      teams: TeamItem[];
      activeTeamId: string;
    })
  | (CommonProps & {
      mode: "super-admin";
    })
  | (CommonProps & {
      mode: "account";
      teams: TeamItem[];
    });

export function AppSidebar(
  props: AppSidebarProps & React.ComponentProps<typeof Sidebar>,
) {
  const { mode, user, items, ...sidebarProps } = props;

  return (
    <Sidebar collapsible="icon" {...sidebarProps}>
      <SidebarHeader>
        {mode === "org" ? (
          <TeamSwitcher teams={props.teams} activeTeamId={props.activeTeamId} />
        ) : mode === "account" ? (
          props.teams.length > 0 ? (
            <TeamSwitcher
              teams={props.teams}
              activeTeamId={props.teams[0].id}
            />
          ) : (
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" asChild>
                  <Link href="/onboarding/new-org">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg border bg-transparent">
                      <PlusIcon weight="bold" />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">
                        Crear organización
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        Empieza un espacio nuevo
                      </span>
                    </div>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          )
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/super-admin">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <ShieldStarIcon weight="bold" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">Notify</span>
                    <span className="truncate text-xs text-muted-foreground">
                      Plataforma
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={items} />
        {mode === "account" ? (
          <SidebarMenu className="px-2">
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive>
                <Link href="/account">
                  <UserCircleIcon />
                  <span>Mi cuenta</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : null}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

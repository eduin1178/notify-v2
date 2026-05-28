"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CaretUpDownIcon,
  CheckIcon,
  DesktopIcon,
  MoonIcon,
  ShieldStarIcon,
  SignOutIcon,
  SunIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { signOut } from "@/lib/auth/client";
import { setThemePreference } from "@/lib/theme/actions";

type ThemePreference = "light" | "dark" | "system";

const COOKIE_NAME = "notify-theme";

function readThemeCookie(): ThemePreference {
  if (typeof document === "undefined") return "system";
  const m = document.cookie.match(/(?:^|; )notify-theme=([^;]+)/);
  const raw = m ? decodeURIComponent(m[1]) : "system";
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
}

function applyThemeClient(pref: ThemePreference) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  const dark =
    pref === "dark" ||
    (pref === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  el.classList.toggle("dark", dark);
  el.dataset.theme = pref;
}

export type NavUserProps = {
  user: {
    name: string;
    email: string;
    image: string | null | undefined;
    isSuperAdmin: boolean;
  };
};

export function NavUser({ user }: NavUserProps) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const [theme, setTheme] = React.useState<ThemePreference>("system");

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(readThemeCookie());
  }, []);

  function selectTheme(value: ThemePreference) {
    setTheme(value);
    applyThemeClient(value);
    document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    void setThemePreference(value);
  }

  async function handleSignOut() {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.replace("/");
          router.refresh();
        },
      },
    });
  }

  const initials = computeInitials(user.name);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                {user.image ? (
                  <AvatarImage src={user.image} alt={user.name} />
                ) : null}
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <CaretUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  {user.image ? (
                    <AvatarImage src={user.image} alt={user.name} />
                  ) : null}
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/account">
                  <UserCircleIcon />
                  Mi cuenta
                </Link>
              </DropdownMenuItem>
              {user.isSuperAdmin ? (
                <DropdownMenuItem asChild>
                  <Link href="/super-admin">
                    <ShieldStarIcon />
                    Plataforma
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  {theme === "dark" ? (
                    <MoonIcon />
                  ) : theme === "light" ? (
                    <SunIcon />
                  ) : (
                    <DesktopIcon />
                  )}
                  Tema
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      selectTheme("light");
                    }}
                  >
                    <SunIcon />
                    <span className="flex-1">Claro</span>
                    {theme === "light" ? (
                      <CheckIcon className="size-4" weight="bold" />
                    ) : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      selectTheme("dark");
                    }}
                  >
                    <MoonIcon />
                    <span className="flex-1">Oscuro</span>
                    {theme === "dark" ? (
                      <CheckIcon className="size-4" weight="bold" />
                    ) : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      selectTheme("system");
                    }}
                  >
                    <DesktopIcon />
                    <span className="flex-1">Sistema</span>
                    {theme === "system" ? (
                      <CheckIcon className="size-4" weight="bold" />
                    ) : null}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                void handleSignOut();
              }}
            >
              <SignOutIcon />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function computeInitials(name: string): string {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

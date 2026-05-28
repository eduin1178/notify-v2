"use client";

import * as React from "react";
import {
  CheckIcon,
  DesktopIcon,
  MoonIcon,
  SunIcon,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setThemePreference } from "@/lib/theme/actions";
import { cn } from "@/lib/utils";

type ThemePreference = "light" | "dark" | "system";

const COOKIE_NAME = "notify-theme";

function readCookie(): ThemePreference {
  if (typeof document === "undefined") return "system";
  const match = document.cookie.match(/(?:^|; )notify-theme=([^;]+)/);
  const raw = match ? decodeURIComponent(match[1]) : "system";
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

function resolveDark(pref: ThemePreference): boolean {
  if (pref === "dark") return true;
  if (pref === "light") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(pref: ThemePreference) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.classList.toggle("dark", resolveDark(pref));
  el.dataset.theme = pref;
}

export type ThemeToggleProps = {
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  variant?: "ghost" | "outline";
  size?: "sm" | "default" | "icon";
  className?: string;
};

export function ThemeToggle({
  align = "end",
  side,
  variant = "ghost",
  size = "icon",
  className,
}: ThemeToggleProps) {
  const [preference, setPreference] = React.useState<ThemePreference>("system");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreference(readCookie());
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (preference !== "system" || typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [preference]);

  function select(value: ThemePreference) {
    setPreference(value);
    applyTheme(value);
    if (document.cookie.indexOf(COOKIE_NAME) === -1) {
      document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    } else {
      document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    }
    void setThemePreference(value);
  }

  const TriggerIcon = mounted
    ? preference === "dark"
      ? MoonIcon
      : preference === "light"
        ? SunIcon
        : DesktopIcon
    : DesktopIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={cn(className)}
          aria-label="Cambiar tema"
        >
          <TriggerIcon weight="bold" />
          {size !== "icon" ? <span>Tema</span> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} side={side} className="w-40">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Tema
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ThemeOption
          icon={<SunIcon weight="bold" />}
          label="Claro"
          active={preference === "light"}
          onSelect={() => select("light")}
        />
        <ThemeOption
          icon={<MoonIcon weight="bold" />}
          label="Oscuro"
          active={preference === "dark"}
          onSelect={() => select("dark")}
        />
        <ThemeOption
          icon={<DesktopIcon weight="bold" />}
          label="Sistema"
          active={preference === "system"}
          onSelect={() => select("system")}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeOption({
  icon,
  label,
  active,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.preventDefault();
        onSelect();
      }}
      className="gap-2"
    >
      {icon}
      <span className="flex-1">{label}</span>
      {active ? <CheckIcon className="size-4" weight="bold" /> : null}
    </DropdownMenuItem>
  );
}

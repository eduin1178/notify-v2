import { cookies } from "next/headers";

export const THEME_COOKIE_NAME = "notify-theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type ThemePreference = "light" | "dark" | "system";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export async function getThemeCookie(): Promise<ThemePreference> {
  const store = await cookies();
  const raw = store.get(THEME_COOKIE_NAME)?.value;
  return isThemePreference(raw) ? raw : "system";
}

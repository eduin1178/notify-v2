"use server";

import { cookies } from "next/headers";

import {
  THEME_COOKIE_MAX_AGE,
  THEME_COOKIE_NAME,
  isThemePreference,
} from "./cookie";

export async function setThemePreference(value: unknown): Promise<void> {
  if (!isThemePreference(value)) return;
  const store = await cookies();
  store.set({
    name: THEME_COOKIE_NAME,
    value,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: THEME_COOKIE_MAX_AGE,
  });
}

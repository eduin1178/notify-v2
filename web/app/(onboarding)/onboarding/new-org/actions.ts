"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { requireSession } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { schema } from "@/lib/db/schema";

type State = { error?: string };

export async function createOrganizationAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim();

  if (name.length < 2) {
    return { error: "El nombre debe tener al menos 2 caracteres." };
  }
  if (name.length > 64) {
    return { error: "El nombre no puede superar los 64 caracteres." };
  }

  const slug = await generateUniqueSlug(name);

  let createdSlug: string;
  try {
    const headerList = await headers();
    const result = await auth.api.createOrganization({
      headers: headerList,
      body: { name, slug },
    });
    if (!result) {
      return { error: "No pudimos crear la organización. Inténtalo de nuevo." };
    }
    createdSlug = result.slug;
  } catch (err) {
    console.error("[create-organization] fallo", err);
    return { error: "No pudimos crear la organización. Inténtalo de nuevo." };
  }

  void session;
  redirect(`/o/${createdSlug}`);
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "org";
  let candidate = base;
  let suffix = 2;

  while (await slugExists(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
    if (suffix > 1000) {
      candidate = `${base}-${Date.now()}`;
      break;
    }
  }

  return candidate;
}

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function slugExists(slug: string): Promise<boolean> {
  const row = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(eq(schema.organization.slug, slug))
    .limit(1);
  return row.length > 0;
}

void ne;
void and;

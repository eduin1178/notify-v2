import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  unique,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),

  role: text("role"),
  banned: boolean("banned"),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  impersonatedBy: text("impersonated_by"),

  activeOrganizationId: text("active_organization_id"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  metadata: text("metadata"),
});

export const member = pgTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Billing seam ──────────────────────────────────────────────────────────
// Catálogo de planes y costura de entitlements/uso. NO incluye pasarela de
// pago ni cobro: precios se almacenan como dato, el cobro lo añade el engine.

export const plan = pgTable("plan", {
  id: text("id").primaryKey(),
  // Clave estable del plan: trial | basic | plus | pro
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  // Precio mensual en USD. Almacenado, no cobrado en esta versión.
  priceUsd: numeric("price_usd", { precision: 10, scale: 4 }).notNull().default("0"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Valor de un entitlement key para un plan. El `kind` del key vive en código
// (lib/services/billing/entitlements.ts); aquí solo se persiste el valor.
// int_value NULL en un key contable/medido representa "ilimitado".
export const planEntitlement = pgTable(
  "plan_entitlement",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    intValue: integer("int_value"),
    boolValue: boolean("bool_value"),
  },
  (t) => ({
    planKeyUnique: unique("plan_entitlement_plan_key_unique").on(t.planId, t.key),
  }),
);

// Suscripción de una organización a un plan. Fuente única de verdad del plan.
// Campos de ciclo/proveedor quedan modelados para el engine (sin uso en v0).
export const subscription = pgTable("subscription", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .unique()
    .references(() => organization.id, { onDelete: "cascade" }),
  planId: text("plan_id")
    .notNull()
    .references(() => plan.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("trialing"),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  provider: text("provider"),
  providerRef: text("provider_ref"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Override de límite por organización. Prevalece sobre el valor del plan.
export const organizationEntitlementOverride = pgTable(
  "organization_entitlement_override",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    intValue: integer("int_value"),
    boolValue: boolean("bool_value"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    orgKeyUnique: unique("org_entitlement_override_org_key_unique").on(
      t.organizationId,
      t.key,
    ),
  }),
);

// Ledger de uso. Definido ahora; lo puebla la feature de Envío (change ②).
export const usageEvent = pgTable("usage_event", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  metric: text("metric").notNull(),
  quantity: integer("quantity").notNull().default(1),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
});

export const schema = {
  user,
  session,
  account,
  verification,
  organization,
  member,
  invitation,
  plan,
  planEntitlement,
  subscription,
  organizationEntitlementOverride,
  usageEvent,
};

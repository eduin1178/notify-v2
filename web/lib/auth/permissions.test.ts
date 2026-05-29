import { describe, expect, it } from "vitest";

import { type Actor, can } from "@/lib/auth/permissions";

const actor = (overrides: Partial<Actor> = {}): Actor => ({
  isSuperAdmin: false,
  orgRole: null,
  ...overrides,
});

describe("can(org.whatsapp.connect)", () => {
  it("permite a owner", () => {
    expect(can(actor({ orgRole: "owner" }), "org.whatsapp.connect")).toBe(true);
  });

  it("permite a admin", () => {
    expect(can(actor({ orgRole: "admin" }), "org.whatsapp.connect")).toBe(true);
  });

  it("rechaza a member", () => {
    expect(can(actor({ orgRole: "member" }), "org.whatsapp.connect")).toBe(
      false,
    );
  });

  it("rechaza a un no-miembro (sin rol en la org)", () => {
    expect(can(actor({ orgRole: null }), "org.whatsapp.connect")).toBe(false);
  });

  it("permite a super admin de plataforma", () => {
    expect(
      can(actor({ isSuperAdmin: true, orgRole: null }), "org.whatsapp.connect"),
    ).toBe(true);
  });
});

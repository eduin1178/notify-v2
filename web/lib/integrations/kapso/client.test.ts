import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createCustomer,
  createSetupLink,
  deletePhoneNumber,
  KapsoApiError,
} from "@/lib/integrations/kapso/client";

const BASE = "https://api.kapso.ai/platform/v1";

function jsonResponse(status: number, data: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response;
}

function emptyResponse(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new Error("no body");
    },
    text: async () => "",
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function lastCall() {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  const headers = init.headers as Record<string, string>;
  const body = init.body ? JSON.parse(init.body as string) : undefined;
  return { url, method: init.method, headers, body };
}

describe("createCustomer", () => {
  it("envía el customer con external_customer_id y desempaqueta data", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        data: { id: "cust-1", name: "Acme", external_customer_id: "org-1" },
      }),
    );

    const result = await createCustomer({
      externalCustomerId: "org-1",
      name: "Acme",
    });

    const call = lastCall();
    expect(call.url).toBe(`${BASE}/customers`);
    expect(call.method).toBe("POST");
    expect(call.headers["X-API-Key"]).toBe("test-key");
    expect(call.body).toEqual({
      customer: { name: "Acme", external_customer_id: "org-1" },
    });
    expect(result).toEqual({
      id: "cust-1",
      name: "Acme",
      externalCustomerId: "org-1",
    });
  });
});

describe("createSetupLink", () => {
  it("envía el setup_link con tipos y lenguaje; omite reconnect si no se pasa", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        data: {
          id: "link-1",
          status: "active",
          url: "https://app.kapso.ai/s/abc",
          expires_at: "2026-07-01T00:00:00Z",
        },
      }),
    );

    const result = await createSetupLink("cust-1", {
      successRedirectUrl: "https://app/success",
      failureRedirectUrl: "https://app/failed",
      allowedConnectionTypes: ["coexistence", "dedicated"],
      language: "es",
    });

    const call = lastCall();
    expect(call.url).toBe(`${BASE}/customers/cust-1/setup_links`);
    expect(call.body.setup_link).toEqual({
      success_redirect_url: "https://app/success",
      failure_redirect_url: "https://app/failed",
      allowed_connection_types: ["coexistence", "dedicated"],
      language: "es",
    });
    expect(call.body.setup_link.reconnect_phone_number).toBeUndefined();
    expect(result).toEqual({
      id: "link-1",
      status: "active",
      url: "https://app.kapso.ai/s/abc",
      expiresAt: "2026-07-01T00:00:00Z",
    });
  });

  it("incluye reconnect_phone_number cuando se pasa", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        data: { id: "link-2", status: "active", url: "https://x", expires_at: null },
      }),
    );

    await createSetupLink("cust-1", {
      successRedirectUrl: "https://app/success",
      failureRedirectUrl: "https://app/failed",
      allowedConnectionTypes: ["dedicated"],
      reconnectPhoneNumber: "+15551234567",
    });

    expect(lastCall().body.setup_link.reconnect_phone_number).toBe(
      "+15551234567",
    );
  });
});

describe("deletePhoneNumber", () => {
  it("hace DELETE al número y maneja 204 sin cuerpo", async () => {
    fetchMock.mockResolvedValue(emptyResponse(204));

    await deletePhoneNumber("pn-1");

    const call = lastCall();
    expect(call.url).toBe(`${BASE}/whatsapp/phone_numbers/pn-1`);
    expect(call.method).toBe("DELETE");
  });
});

describe("manejo de errores", () => {
  it("lanza KapsoApiError con el status en respuestas no-2xx", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { error: "not found" }));

    await expect(
      createCustomer({ externalCustomerId: "org-1", name: "Acme" }),
    ).rejects.toMatchObject({ status: 404 });

    await expect(
      createCustomer({ externalCustomerId: "org-1", name: "Acme" }),
    ).rejects.toBeInstanceOf(KapsoApiError);
  });
});

/**
 * Cliente fino y tipado para la Kapso Platform API (`/platform/v1`).
 *
 * Cubre SOLO la capa de plataforma usada para conectar cuentas (customers,
 * setup_links, phone_numbers). La mensajería va por el proxy de Meta y el SDK
 * `@kapso/whatsapp-cloud-api`, fuera del alcance de este módulo.
 *
 * Autenticación: header `X-API-Key` con la `KAPSO_API_KEY` de plataforma.
 * No es un módulo de servicios: lo consume `lib/services/whatsapp`. Aun así
 * no importa `next/*`, `hono`, `@hono/*` ni `web/app/**`.
 */

import { env } from "@/lib/env";

const PLATFORM_BASE = `${env.KAPSO_API_BASE_URL}/platform/v1`;

export type KapsoConnectionType = "coexistence" | "dedicated";

export type CreateCustomerInput = {
  /** Id externo estable; usamos el `organizationId` de Notify para idempotencia. */
  externalCustomerId: string;
  name: string;
};

export type KapsoCustomer = {
  id: string;
  name: string | null;
  externalCustomerId: string | null;
};

export type CreateSetupLinkInput = {
  successRedirectUrl: string;
  failureRedirectUrl: string;
  allowedConnectionTypes: KapsoConnectionType[];
  /** ISO 639-1; el proyecto usa "es". */
  language?: string;
  /** Para reconexión: fija el número existente; fuerza provision=false en Kapso. */
  reconnectPhoneNumber?: string;
};

export type KapsoSetupLink = {
  id: string;
  status: string;
  url: string;
  expiresAt: string | null;
};

/** Número de WhatsApp tal como lo conoce Kapso (subset usado por Notify). */
export type KapsoPhoneNumber = {
  /** Meta phone number ID — el identificador rey. */
  phoneNumberId: string;
  businessAccountId: string | null;
  displayPhoneNumber: string | null;
  /** Nombre de negocio verificado por Meta (preferido para identificar). */
  verifiedName: string | null;
  /** Nombre visible al cliente (custom en Kapso). */
  displayName: string | null;
  /** Etiqueta interna del número en Kapso. */
  name: string | null;
  /** true = coexistence (WhatsApp Business App); false = dedicated. */
  isCoexistence: boolean | null;
  /** Estado de conexión de Meta (p. ej. "CONNECTED"). */
  status: string | null;
  /** Customer de Kapso dueño del número; null si no está asignado. */
  customerId: string | null;
};

/** Error de transporte/HTTP de Kapso. El servicio decide cómo traducirlo a dominio. */
export class KapsoApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string, message?: string) {
    super(message ?? `Kapso API respondió ${status}`);
    this.name = "KapsoApiError";
    this.status = status;
    this.body = body;
  }
}

type DataEnvelope<T> = { data: T };

type RawCustomer = {
  id: string;
  name?: string | null;
  external_customer_id?: string | null;
};

type RawSetupLink = {
  id: string;
  status?: string | null;
  url: string;
  expires_at?: string | null;
};

type RawPhoneNumber = {
  id: string;
  phone_number_id?: string | null;
  business_account_id?: string | null;
  display_phone_number?: string | null;
  verified_name?: string | null;
  display_name?: string | null;
  name?: string | null;
  is_coexistence?: boolean | null;
  status?: string | null;
  customer_id?: string | null;
};

function toPhoneNumber(raw: RawPhoneNumber): KapsoPhoneNumber {
  return {
    phoneNumberId: raw.phone_number_id ?? raw.id,
    businessAccountId: raw.business_account_id ?? null,
    displayPhoneNumber: raw.display_phone_number ?? null,
    verifiedName: raw.verified_name ?? null,
    displayName: raw.display_name ?? null,
    name: raw.name ?? null,
    isCoexistence: raw.is_coexistence ?? null,
    status: raw.status ?? null,
    customerId: raw.customer_id ?? null,
  };
}

async function request<T>(
  path: string,
  init: { method: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${PLATFORM_BASE}${path}`, {
    method: init.method,
    headers: {
      "X-API-Key": env.KAPSO_API_KEY,
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    // Llamada servidor→servidor: nunca cachear.
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new KapsoApiError(res.status, text);
  }

  // 204 No Content (p. ej. DELETE) no trae cuerpo.
  if (res.status === 204) return undefined as T;

  return (await res.json()) as T;
}

/** POST /platform/v1/customers */
export async function createCustomer(
  input: CreateCustomerInput,
): Promise<KapsoCustomer> {
  const res = await request<DataEnvelope<RawCustomer>>("/customers", {
    method: "POST",
    body: {
      customer: {
        name: input.name,
        external_customer_id: input.externalCustomerId,
      },
    },
  });
  return {
    id: res.data.id,
    name: res.data.name ?? null,
    externalCustomerId: res.data.external_customer_id ?? null,
  };
}

/** POST /platform/v1/customers/:id/setup_links */
export async function createSetupLink(
  customerId: string,
  input: CreateSetupLinkInput,
): Promise<KapsoSetupLink> {
  const res = await request<DataEnvelope<RawSetupLink>>(
    `/customers/${encodeURIComponent(customerId)}/setup_links`,
    {
      method: "POST",
      body: {
        setup_link: {
          success_redirect_url: input.successRedirectUrl,
          failure_redirect_url: input.failureRedirectUrl,
          allowed_connection_types: input.allowedConnectionTypes,
          ...(input.language ? { language: input.language } : {}),
          ...(input.reconnectPhoneNumber
            ? { reconnect_phone_number: input.reconnectPhoneNumber }
            : {}),
        },
      },
    },
  );
  return {
    id: res.data.id,
    status: res.data.status ?? "active",
    url: res.data.url,
    expiresAt: res.data.expires_at ?? null,
  };
}

/** GET /platform/v1/whatsapp/phone_numbers?customer_id=:id (lista por customer) */
export async function listPhoneNumbers(
  customerId: string,
): Promise<KapsoPhoneNumber[]> {
  const res = await request<DataEnvelope<RawPhoneNumber[]>>(
    `/whatsapp/phone_numbers?customer_id=${encodeURIComponent(customerId)}&per_page=100`,
    { method: "GET" },
  );
  return res.data.map(toPhoneNumber);
}

/** GET /platform/v1/whatsapp/phone_numbers/:phone_number_id */
export async function getPhoneNumber(
  phoneNumberId: string,
): Promise<KapsoPhoneNumber> {
  const res = await request<DataEnvelope<RawPhoneNumber>>(
    `/whatsapp/phone_numbers/${encodeURIComponent(phoneNumberId)}`,
    { method: "GET" },
  );
  return toPhoneNumber(res.data);
}

/** DELETE /platform/v1/whatsapp/phone_numbers/:phone_number_id (204) */
export async function deletePhoneNumber(phoneNumberId: string): Promise<void> {
  await request<void>(
    `/whatsapp/phone_numbers/${encodeURIComponent(phoneNumberId)}`,
    { method: "DELETE" },
  );
}

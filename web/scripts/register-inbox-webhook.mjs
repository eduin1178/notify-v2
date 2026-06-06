// Script de un solo uso: registra el webhook number-scoped de mensajes del
// inbox en Kapso para el número conectado de la organización.
// Lee secretos de .env / .env.local (no los imprime). Idempotente.
//
//   node scripts/register-inbox-webhook.mjs
//
// Borrar tras usar si se desea (el registro automático cubre números futuros).

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const PUBLIC_URL = "https://local.eduinpro.net";
const WEBHOOK_URL = `${PUBLIC_URL}/api/webhooks/kapso`;
const EVENTS = [
  "whatsapp.message.received",
  "whatsapp.message.sent",
  "whatsapp.message.delivered",
  "whatsapp.message.read",
  "whatsapp.message.failed",
  "whatsapp.conversation.created",
  "whatsapp.conversation.ended",
  "whatsapp.conversation.inactive",
];

function loadEnvFile(path, into) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    into[key] = value;
  }
}

const env = {};
loadEnvFile(".env", env);
loadEnvFile(".env.local", env); // .local sobrescribe

const DATABASE_URL = env.DATABASE_URL;
const KAPSO_API_KEY = env.KAPSO_API_KEY;
const KAPSO_WEBHOOK_SECRET = env.KAPSO_WEBHOOK_SECRET;
const KAPSO_API_BASE_URL = env.KAPSO_API_BASE_URL || "https://api.kapso.ai";

const missing = [];
if (!DATABASE_URL) missing.push("DATABASE_URL");
if (!KAPSO_API_KEY) missing.push("KAPSO_API_KEY");
if (!KAPSO_WEBHOOK_SECRET) missing.push("KAPSO_WEBHOOK_SECRET");
if (missing.length) {
  console.error("Faltan variables en .env/.env.local:", missing.join(", "));
  process.exit(1);
}

const PLATFORM = `${KAPSO_API_BASE_URL}/platform/v1`;

async function main() {
  const sql = neon(DATABASE_URL);
  const rows = await sql`
    select id, phone_number_id, display_phone_number, name
    from whatsapp_connection
    where status = 'connected' and phone_number_id is not null
    order by connected_at desc nulls last
    limit 5
  `;

  if (rows.length === 0) {
    console.error("No hay ningún número 'connected' con phone_number_id en la BD.");
    process.exit(1);
  }

  console.log(`Números conectados encontrados: ${rows.length}`);
  for (const conn of rows) {
    const pnid = conn.phone_number_id;
    const label = conn.name || conn.display_phone_number || pnid;
    const base = `${PLATFORM}/whatsapp/phone_numbers/${encodeURIComponent(pnid)}/webhooks`;

    // Idempotencia: ¿ya existe un webhook con nuestra URL?
    const listRes = await fetch(base, {
      method: "GET",
      headers: { "X-API-Key": KAPSO_API_KEY },
    });
    if (listRes.ok) {
      const body = await listRes.json().catch(() => ({}));
      const existing = (body.data ?? []).find((w) => w.url === WEBHOOK_URL);
      if (existing) {
        console.log(`• [${label}] ya tiene el webhook (id ${existing.id}). Omitido.`);
        continue;
      }
    } else {
      console.log(
        `• [${label}] no pude listar webhooks (HTTP ${listRes.status}); intento crear de todas formas.`,
      );
    }

    const createRes = await fetch(base, {
      method: "POST",
      headers: {
        "X-API-Key": KAPSO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        whatsapp_webhook: {
          url: WEBHOOK_URL,
          kind: "kapso",
          secret_key: KAPSO_WEBHOOK_SECRET,
          active: true,
          buffer_enabled: false,
          payload_version: "v2",
          events: EVENTS,
        },
      }),
    });

    if (createRes.ok) {
      const body = await createRes.json().catch(() => ({}));
      console.log(
        `✓ [${label}] webhook creado (id ${body.data?.id ?? "?"}) → ${WEBHOOK_URL}`,
      );
    } else {
      const txt = await createRes.text().catch(() => "");
      console.error(`✗ [${label}] error HTTP ${createRes.status}: ${txt}`);
    }
  }
}

main().catch((err) => {
  console.error("Fallo:", err?.message ?? err);
  process.exit(1);
});

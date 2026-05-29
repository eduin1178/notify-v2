## Context

Notify es multi-tenant: la organización (`/api/v1/orgs/:orgId/...`) es la fuente única de verdad. La arquitectura separa dominio (`web/lib/services/`) de transporte (rutas Hono y Server Actions), con `TenantServiceContext` inyectando `db`, `currentOrg`, `entitlements` y `usage`. La autorización de dominio se evalúa con `can(actor, action)` en `web/lib/auth/permissions.ts`. El billing ya define el entitlement `whatsapp_numbers` (counted_cap).

Kapso actúa como BSP sobre la WhatsApp Cloud API de Meta. Expone dos superficies distintas:
- **Platform API** (`https://api.kapso.ai/platform/v1`, header `X-API-Key`): customers, setup_links, phone_numbers, webhooks. **Es la que usa esta feature.**
- **Meta proxy** (`/meta/whatsapp/...`): mensajería, plantillas, flows. Cubierto por el SDK `@kapso/whatsapp-cloud-api`. **Fuera de alcance aquí.**

Onboarding confirmado vía context7:
- `POST /platform/v1/customers` — crear customer.
- `POST /platform/v1/customers/:id/setup_links` — body `{ success_redirect_url, failure_redirect_url, allowed_connection_types, language, theme_config?, reconnect_phone_number? }`; respuesta `{ id, status, url, expires_at }`. Crear uno nuevo revoca el anterior; expira a 30 días.
- `GET /platform/v1/customers/:id/setup_links` — listar.
- `DELETE /platform/v1/whatsapp/phone_numbers/:phone_number_id` — eliminar número (204).
- Webhooks de proyecto: `whatsapp.phone_number.created`, `whatsapp.phone_number.deleted` (payload `{ phone_number_id, project.id, customer.id }`).

## Goals / Non-Goals

**Goals:**
- Vincular cuentas de WhatsApp a una organización con autorización owner/admin y gating por `whatsapp_numbers`.
- Ciclo de vida completo: conectar, listar, estado, desconectar, reconectar.
- Detección robusta de conexión/eliminación por webhook (fuente de verdad) + redirect (UX).
- Cero secretos de Meta en nuestra base de datos.
- Respetar la separación dominio/transporte y los patrones existentes (servicios puros, `DomainErrors`, zod-openapi).

**Non-Goals:**
- Disparo automático de `needs_reconnect` (listener de `whatsapp.message.failed`).
- Envío de mensajes, plantillas, flows, embeds de inbox, broadcasts.
- Uso del SDK `@kapso/whatsapp-cloud-api` (se reserva para la futura capa de mensajería).
- UI final pulida del wizard (se entrega la mínima funcional; el detalle visual puede iterarse).

## Decisions

### D1. Una organización = un customer de Kapso (1:1), creación perezosa
Persistir `kapso_customer_id` en `organization`. Crear el customer en el primer "Conectar" con `external_id = organizationId`.
- **Por qué**: evita customers fantasma para orgs que nunca conectan; el `external_id` da idempotencia ante reintentos; permite el ruteo del webhook (`customer.id → org`).
- **Alternativa descartada**: crear el customer al crear la organización (eager) — genera basura y acopla la creación de org con Kapso.

### D2. Kapso como BSP — no almacenamos tokens de Meta
Toda llamada usa una sola `KAPSO_API_KEY` de plataforma. La tabla guarda solo identificadores.
- **Por qué**: Kapso custodia las credenciales OAuth de Meta; replicarlas sería un pasivo de seguridad y de rotación. Simplifica el modelo de datos (sin cifrado por-org).
- **Alternativa descartada**: almacenar `access_token` por conexión — innecesario con un BSP y riesgoso.

### D3. Webhook como fuente de verdad; redirect solo para UX
`whatsapp.phone_number.created` consolida el estado `connected`; `whatsapp.phone_number.deleted` consolida `disconnected`. El redirect solo pinta confirmación inmediata.
- **Por qué**: el redirect puede no ocurrir (cierre de pestaña) y llega antes de que el backend procese; el webhook es server-to-server y confiable. `.deleted` además detecta remociones externas (anti-drift).
- **Alternativa descartada**: solo redirect — frágil y deja estados huérfanos.

### D4. Cliente Kapso Platform tipado y fino (fetch), no SDK
Adaptador en `web/lib/integrations/kapso/` (cliente `fetch` con `X-API-Key`, base `KAPSO_API_BASE_URL`, tipos de request/response, manejo de errores → `DomainError` cuando aplique). El servicio de dominio lo consume; las rutas/webhook no llaman a Kapso directamente.
- **Por qué**: el SDK oficial cubre solo el proxy de Meta, no la Platform API. Un adaptador propio aísla el dominio del transporte HTTP externo y deja el SDK libre para la futura mensajería.
- **Alternativa descartada**: llamar `fetch` disperso desde el servicio — rompe la testabilidad y mezcla responsabilidades.

### D5. Autorización en el servicio, no en el middleware
Nueva acción `org.whatsapp.connect` evaluada con `can(actor, ...)` dentro de `lib/services/whatsapp/service.ts`. El middleware `requireOrgMembership` solo verifica membresía; la distinción owner/admin vive en el dominio.
- **Por qué**: regla de la casa (CLAUDE.md): la autorización de dominio NO vive en adaptadores. Permite reutilizar la regla desde Server Actions y REST por igual.

### D6. Webhook fuera de `/api/v1`, con firma e idempotencia
Ruta dedicada (p. ej. `app/api/webhooks/kapso/route.ts`), sin sesión, igual que el handler de better-auth. Verifica la firma antes de procesar y deduplica por `X-Idempotency-Key`.
- **Por qué**: es un canal máquina-a-máquina global del proyecto, no tenant-scoped ni con cookie; la firma sustituye a la sesión como control de acceso.
- **Alternativa descartada**: montar el webhook dentro de `/api/v1/orgs/:orgId/...` — no hay org en el path del evento ni sesión; sería forzado.

**Firma (verificado en docs de Kapso):** HMAC **SHA256** del **raw body**, enviada en el header `X-Webhook-Signature` en hex. Verificación con `crypto.timingSafeEqual`; secreto en `KAPSO_WEBHOOK_SECRET`.
- **Raw body obligatorio**: leer `await request.text()` y calcular el HMAC sobre ese string crudo ANTES de `JSON.parse`. NO usar `request.json()` previo ni re-serializar el objeto parseado (cambiaría los bytes y rompería la firma). El ejemplo `JSON.stringify(req.body)` de la doc es frágil; su propia nota "Use the raw payload" manda usar el crudo.
- **Idempotencia DB-backed**: dedupe por el header `X-Idempotency-Key` persistido en una tabla ligera (`whatsapp_webhook_event` o equivalente). El `Set` en memoria del ejemplo de la doc NO sirve en serverless (Neon + Vercel): las invocaciones no comparten memoria.
- **SLA**: responder en < 10 s (verificar firma → aplicar el efecto, que es una sola escritura → 200). Si llega firma inválida/ausente → 401; si el evento es de un customer/número desconocido o ya procesado → 200 sin efectos.

### D7. Modelo de estados de la conexión
`pending → connected → disconnected`, con `connected → needs_reconnect` (sin disparo auto) y `needs_reconnect → connected` (reconexión), y `pending → failed`. Correlación del `pending` por `setup_link_id` (no hay `phone_number_id` aún al generar el link).
- **Por qué**: refleja fielmente las señales reales de Kapso (created/deleted) y la limitación de que la rotura silenciosa no emite webhook.

### D8. Gating leyendo `whatsapp_numbers` vía el port existente
Al crear un número nuevo, `ctx.entitlements.authorize({ key: "whatsapp_numbers", current })` contra el conteo de conexiones que cuentan al cupo.
- **Por qué**: reutiliza la costura de billing; no duplica lógica de planes.
- **`pending` NO cuenta** contra el cupo: solo `connected` y `needs_reconnect` (números comprometidos). Un intento en curso no debe consumir el límite del plan; de lo contrario un pendiente atascado bloquearía reintentar en planes con tope 1.
- **Reuso del intento pendiente**: si ya existe una conexión `pending` para la org, `connectWhatsApp` la REUTILIZA regenerando el setup link (Kapso revoca el anterior) y NO aplica gating en ese caso. El gating corre únicamente al crear un número nuevo (sin `pending` previo). Así reintentar funciona sin acumular filas.
- **Cancelar pendiente**: `disconnect` sobre una conexión sin `phone_number_id` (`pending`/`failed`) elimina la fila sin llamar a Kapso.

## Risks / Trade-offs

- **Carrera redirect vs webhook** → El estado definitivo lo fija el webhook; el redirect solo muestra "confirmando…". La UI consulta/poll-ea hasta consolidar.
- **Webhook de customer/número desconocido** → Responder 200 e ignorar (registrar), nunca 5xx, para no provocar reintentos infinitos de Kapso.
- **Eliminación en Kapso asíncrona** → `whatsapp.phone_number.deleted` se emite al inicio del teardown; tratamos `disconnected` como autoritativo desde ese evento, con UI optimista entre la acción y el webhook.
- **Rotura silenciosa de token sin webhook** → `needs_reconnect` no se disparará automáticamente en este alcance; se documenta como dependencia futura de la capa de envío. Mitigación interina: acción manual de reconexión disponible.
- **Idempotencia del setup link** → crear un nuevo link revoca el anterior; al regenerar, actualizar/sustituir la fila `pending` correlacionada para no acumular pendientes.
- **Secreto de firma del webhook** → almacenar en env; rotación documentada. Sin firma válida, 401.

## Migration Plan

1. Añadir columna `organization.kapso_customer_id` (nullable), tabla `whatsapp_connection` y tabla `whatsapp_webhook_event` (idempotencia DB-backed); generar migración Drizzle (`drizzle-kit generate`). Compatible hacia atrás (aditivo).
2. Añadir variables a `web/lib/env.ts` (`KAPSO_API_KEY`, `KAPSO_API_BASE_URL`, secreto del webhook) y a `env.example`.
3. Registrar el webhook de proyecto en Kapso apuntando a la ruta desplegada (`whatsapp.phone_number.created`, `whatsapp.phone_number.deleted`).
4. Rollback: la migración es aditiva; revertir = quitar rutas/servicio y, si se desea, drop de tabla/columna. No hay datos de producción que migrar.

## Open Questions

Todas resueltas para este cambio:

- ~~Header y algoritmo de la firma del webhook~~ → **RESUELTO** (D6): HMAC SHA256 sobre raw body, header `X-Webhook-Signature` (hex), idempotencia por `X-Idempotency-Key`.
- ~~Semántica fina de `theme_config`~~ → **RESUELTO**: NO se personaliza el setup link en este cambio. Se usan los defaults de Kapso + `language: "es"`. El branding queda como mejora posterior (un solo campo, sin valor de dominio ahora).
- ~~Política ante reconexión que selecciona un WABA/número distinto~~ → **RESUELTO**: Kapso falla el setup y redirige a `failure_redirect_url`; se mapea a un mensaje en español neutral que pide reconectar el MISMO número. La conexión permanece en `needs_reconnect` (no se corrompe el estado).

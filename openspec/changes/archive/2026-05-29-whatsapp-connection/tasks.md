## 1. Configuración y datos

- [x] 1.1 Añadir `KAPSO_API_KEY`, `KAPSO_API_BASE_URL` y el secreto de verificación del webhook (`KAPSO_WEBHOOK_SECRET`) al `envSchema` de `web/lib/env.ts` y a `env.example`
- [x] 1.2 Añadir columna `kapso_customer_id` (text, nullable, unique) a la tabla `organization` en `web/lib/db/schema.ts`
- [x] 1.3 Crear tabla `whatsapp_connection` en `web/lib/db/schema.ts` (1 org → N): `id`, `organization_id` (FK cascade), `kapso_customer_id`, `setup_link_id`, `phone_number_id` (nullable), `business_account_id` (nullable), `display_phone_number` (nullable), `status` (`pending|connected|disconnected|needs_reconnect|failed`), `connected_at`, `created_at`, `updated_at`; índices/único por `organization_id`+`phone_number_id`
- [x] 1.4 Crear tabla `whatsapp_webhook_event` (idempotencia DB-backed): `idempotency_key` (unique), `event`, `processed_at` — necesaria porque el `Set` en memoria no sirve en serverless
- [x] 1.5 Generar la migración Drizzle (`pnpm drizzle-kit generate`) y verificar el SQL en `web/drizzle/migrations/`

## 2. Adaptador Kapso Platform API

- [x] 2.1 Crear `web/lib/integrations/kapso/client.ts`: cliente `fetch` tipado con header `X-API-Key`, base `KAPSO_API_BASE_URL`, y traducción de errores HTTP
- [x] 2.2 Implementar `createCustomer({ externalCustomerId, name })` → `POST /platform/v1/customers`
- [x] 2.3 Implementar `createSetupLink(customerId, { successRedirectUrl, failureRedirectUrl, allowedConnectionTypes, language, reconnectPhoneNumber? })` → `POST /platform/v1/customers/:id/setup_links`
- [x] 2.4 Implementar `deletePhoneNumber(phoneNumberId)` → `DELETE /platform/v1/whatsapp/phone_numbers/:phone_number_id` (204)
- [x] 2.5 Definir tipos de request/response del adaptador y exportarlos para el dominio

## 3. Autorización

- [x] 3.1 Añadir la acción de dominio `org.whatsapp.connect` en `web/lib/auth/permissions.ts` con regla owner/admin
- [x] 3.2 Añadir un escenario/prueba de la regla (member y no-miembro rechazados; owner/admin permitidos) — vitest configurado (`vitest.config.ts`, script `test`), `lib/auth/permissions.test.ts` con 5 casos, todos en verde.

## 4. Capa de servicios `whatsapp`

- [x] 4.1 Crear `web/lib/services/whatsapp/schemas.ts` con los DTO/zod de input/output (conexión, listado, estado, connect, disconnect, reconnect)
- [x] 4.2 `ensureKapsoCustomer(ctx)`: creación perezosa del customer y persistencia de `kapso_customer_id` (idempotente por `external_customer_id = organizationId`)
- [x] 4.3 `connectWhatsApp(ctx)`: gating con `whatsapp_numbers`, genera setup link (`allowed_connection_types: ["coexistence","dedicated"]`, `language: "es"`), crea fila `pending` con `setup_link_id`, devuelve `url`
- [x] 4.4 `listConnections(ctx)` y `getConnection(ctx, id)` con aislamiento por organización
- [x] 4.5 `disconnect(ctx, id)`: autoriza owner/admin, llama `deletePhoneNumber`, deja estado optimista de transición
- [x] 4.6 `reconnect(ctx, id)`: autoriza owner/admin, genera setup link con `reconnect_phone_number` (provision=false)
- [x] 4.7 `applyPhoneNumberCreated({ customerId, phoneNumberId, ... })`: resuelve org, promueve `pending → connected`, rellena identificadores (idempotente)
- [x] 4.8 `applyPhoneNumberDeleted({ customerId, phoneNumberId })`: marca `disconnected` (cubre acción propia y remoción externa; idempotente)
- [x] 4.9 Usar `DomainErrors` (forbidden/notFound/conflict) en todos los caminos de error de dominio

## 5. REST API tenant-scoped

- [x] 5.1 `POST /api/v1/orgs/:orgId/whatsapp/connections` (conectar) → `connectWhatsApp`
- [x] 5.2 `GET /api/v1/orgs/:orgId/whatsapp/connections` (listar) y `GET .../connections/:id` (estado)
- [x] 5.3 `DELETE /api/v1/orgs/:orgId/whatsapp/connections/:id` (desconectar) → `disconnect`
- [x] 5.4 `POST /api/v1/orgs/:orgId/whatsapp/connections/:id/reconnect` → `reconnect`
- [x] 5.5 Montar el router con `requireSession` + `requireOrgMembership` y `buildTenantServiceContext`, reutilizando los schemas de `lib/services/whatsapp/schemas.ts` (sin duplicar)

## 6. Webhook de Kapso

- [x] 6.1 Crear ruta dedicada fuera de `/api/v1` (`web/app/api/webhooks/kapso/route.ts`), sin sesión, runtime nodejs
- [x] 6.2 Leer el cuerpo crudo con `await request.text()` y verificar la firma HMAC SHA256 (hex) del header `X-Webhook-Signature` con `KAPSO_WEBHOOK_SECRET` usando `crypto.timingSafeEqual`; responder 401 si es inválida. NO usar `request.json()` antes de verificar ni re-serializar el objeto
- [x] 6.3 `JSON.parse` del crudo solo tras verificar; idempotencia por `X-Idempotency-Key` contra `whatsapp_webhook_event` (responder 200 si ya procesado)
- [x] 6.4 Responder 200 sin efectos ante eventos de customer/número desconocido; mantener el handler < 10 s
- [x] 6.5 Enrutar `whatsapp.phone_number.created` → `applyPhoneNumberCreated`; `whatsapp.phone_number.deleted` → `applyPhoneNumberDeleted`

## 7. UI mínima de conexión

- [x] 7.1 Acción/entrada en la sección de organización (visible solo a owner/admin) para iniciar la conexión y redirigir al `url` del setup link
- [x] 7.2 Página de éxito (`success_redirect_url`) que lee los query params y muestra "confirmando…" consolidando con el estado del backend
- [x] 7.3 Página de fallo (`failure_redirect_url`) que mapea `error_code` a un mensaje en español neutral
- [x] 7.4 Listado de conexiones con su estado y acciones desconectar/reconectar (gated owner/admin)

## 8. Verificación

- [x] 8.1 `pnpm lint` y `pnpm build` sin errores (+ `pnpm test` con 5 casos en verde)
- [x] 8.2 Probar el flujo end-to-end contra Kapso (sandbox): conectar → webhook created → connected; desconectar → webhook deleted → disconnected; reconectar — verificado en runtime por el usuario (túnel + credenciales reales)
- [x] 8.3 Verificar gating: alcanzar el límite de `whatsapp_numbers` rechaza con `forbidden` — verificado en runtime por el usuario
- [x] 8.4 Verificar aislamiento entre organizaciones y que no se persisten secretos de Meta — verificado en runtime por el usuario (código ya confirmado por revisión: queries org-scoped, tabla sin columnas de token)

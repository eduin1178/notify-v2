# Tasks

Entrega por fases. Cada fase es un slice revisable por PR (work-unit commits) dentro del presupuesto de ~400 líneas. Cada fase deja la app funcional.

> **Decisión pendiente antes de la UI de la Fase 1**: estrategia de realtime (polling vs push vs SSE). Ver `design.md` → Open Questions. v1 recomendado: polling con SWR sobre el índice local.

## Fase 1 — Índice + recepción + navegación (lectura)

### 1.1 Datos
- [x] 1.1.1 Añadir tabla `conversation` a `web/lib/db/schema.ts`: `id` (pk), `organization_id` (FK cascade), `whatsapp_connection_id` (FK cascade), `contact_id` (FK nullable, set null), `kapso_conversation_id` (unique, nullable), `phone_number`, `notify_status` (`abierta|pendiente|cerrada`, default `abierta`), `assigned_user_id` (FK user, nullable, set null), `last_inbound_at`, `last_message_at`, `last_message_text`, `last_message_type`, `unread_count` (default 0), `created_at`, `updated_at`
- [x] 1.1.2 Añadir índices: `(organization_id, whatsapp_connection_id, last_message_at)`, `(organization_id, assigned_user_id)`, `(organization_id, notify_status)`; unique en `kapso_conversation_id`
- [x] 1.1.3 Añadir tabla `inbox_settings`: `id` (pk), `organization_id` (FK cascade), `whatsapp_connection_id` (FK cascade, **unique**), `reopen_behavior` (`reopen_keep_agent|reopen_unassign|stay_closed`, default `reopen_keep_agent`), `send_read_receipts` (boolean, default true), `created_at`, `updated_at`
- [x] 1.1.4 Registrar `conversation` e `inbox_settings` en el objeto `schema` exportado
- [x] 1.1.5 Generar la migración Drizzle (`pnpm db:generate`) y verificar el SQL en `web/drizzle/migrations/` (`0007_nebulous_hellcat.sql`)
- [x] 1.1.6 Añadir tabla `inbox_message_usage` (ancla de dedup por WAMID, design D7) y migración `0008_lyrical_monster_badoon.sql` (no estaba en el plan literal; necesaria para "sin doble conteo")

### 1.2 Adaptador Kapso (lectura)
- [x] 1.2.1 Extender `web/lib/integrations/kapso/client.ts` con `listConversations({ phoneNumberId, ...filtros, cursor })` → `GET /whatsapp/conversations` (Platform v1), con tipos de respuesta (incluye `kapso.{last_inbound_at, last_message_text, ...}`)
- [x] 1.2.2 Añadir `listMessages({ conversationId, cursor, limit })` → `GET /whatsapp/messages` (cursor, newest-first), con tipos (payload Meta + `kapso.{direction, status, media_url, transcript, content}`)
- [x] 1.2.3 Añadir registro de webhook number-scoped `ensureMessageWebhook(phoneNumberId)` → `POST /whatsapp/phone_numbers/{id}/webhooks` (`kind=kapso`, `buffer_enabled=false`, eventos de mensaje/conversación, secret existente); idempotente

### 1.3 Servicio `inbox` (lectura + ingestión)
- [x] 1.3.1 Crear `web/lib/services/inbox/schemas.ts`: `ConversationDto`, `ListConversationsQuery` (filtros: número, estado, asignación, búsqueda, cursor/página), `ConversationListResponse`, `MessageDto`, `MessageThreadResponse`
- [x] 1.3.2 Crear `web/lib/services/inbox/window.ts`: helpers de ventana 24h (`isWindowOpen(lastInboundAt, now)`, `windowClosesAt`, `remaining`)
- [x] 1.3.3 Crear `web/lib/services/inbox/usage.ts`: `recordMessageUsage(db, { wamid, direction })` (dedup por WAMID vía `inbox_message_usage`) y `recordConversationWindow(db, orgId)` (métrica analítica)
- [x] 1.3.4 `listConversations(ctx, query)`: query org-scoped sobre el índice local, filtrada por número/estado/asignación; devuelve preview, estado, asignación, no leídos y datos de ventana
- [x] 1.3.5 `getMessages(ctx, conversationId, cursor)`: valida que la conversación es de la org y hace read-through a Kapso `listMessages`
- [x] 1.3.6 `ingestInboundMessage(deps, payload)`: resolver `phone_number_id → whatsapp_connection → org`; resolver/crear `contact` por teléfono (`source=whatsapp`, omitir si no hay teléfono normalizable); upsert de `conversation` por `kapso_conversation_id` (actualiza `last_inbound_at`, preview, `unread_count++`); aplicar `reopen_behavior` si estaba `cerrada`; `recordMessageUsage` + `recordConversationWindow` cuando aplique
- [x] 1.3.7 `ingestDeliveryStatus(deps, payload)`: registro/log del estado de entrega (en Fase 1 el hilo refleja el estado por read-through; reflexión enriquecida en Fase 3)
- [x] 1.3.8 Usar `DomainErrors` (forbidden/notFound/conflict/validation) en todos los caminos

### 1.4 Webhook (extensión)
- [x] 1.4.1 Extender el `switch` de `app/api/webhooks/kapso/route.ts` con `whatsapp.message.received` → `ingestInboundMessage`; `*.sent|.delivered|.read|.failed` → `ingestDeliveryStatus`; `whatsapp.conversation.*` → manejo informativo
- [x] 1.4.2 Soportar el formato **batch** de Kapso (varios mensajes por entrega) iterando el array; dedup por WAMID en cada uno
- [x] 1.4.3 Llamar `ensureMessageWebhook(phoneNumberId)` tras `applyPhoneNumberCreated` en la ruta del webhook (suscripción automática al conectar; idempotente; try/catch para no tumbar el webhook)

### 1.5 REST API (lectura)
- [x] 1.5.1 Crear `web/lib/api/routes/v1/orgs/inbox.ts` con router `OpenAPIHono`, middleware `[requireSession, requireOrgMembership]`, `buildTenantServiceContext`, reutilizando los schemas del servicio
- [x] 1.5.2 `GET /orgs/{orgId}/inbox/numbers`, `GET /orgs/{orgId}/inbox/conversations` (lista filtrable) y `GET /orgs/{orgId}/inbox/conversations/{id}/messages` (hilo read-through)
- [x] 1.5.3 Montar el router en `web/lib/api/routes/v1/index.ts`

### 1.6 UI (lectura)
- [x] 1.6.1 Crear `app/(app)/org/[orgSlug]/inbox/page.tsx` con layout de tres columnas (lista / hilo / contexto) e ítem de navegación en el layout
- [x] 1.6.2 Columna izquierda: selector de número (default primero conectado), filtros de estado (Abierta/Pendiente/Cerrada) y asignación (Mías/Sin asignar/Otros), búsqueda, lista de chats con avatar/nombre/preview/hora/badge de no leídos
- [x] 1.6.3 Panel central: hilo de mensajes (read-through, paginado), banner de ventana de 24h (tiempo restante / cierre), render básico de tipos (texto, imagen, documento, audio, video) con marcas de entrega
- [x] 1.6.4 Panel derecho: datos del contacto y de la conversación (estado, asignado, último entrante, ventana)
- [x] 1.6.5 Aplicar la estrategia de realtime decidida (v1: polling/SWR sobre el índice, `refreshInterval` 4s)
- [x] 1.6.6 Copy en español neutral (tú, sin voseo) en labels, placeholders, estados vacíos y mensajes

### 1.7 Verificación Fase 1
- [x] 1.7.1 `pnpm exec tsc --noEmit` y `pnpm lint` sin errores (`pnpm build` requiere variables de entorno; no ejecutable en este entorno)
- [ ] 1.7.2 Verificar end-to-end (requiere DB + Kapso + número conectado): aplicar migraciones; registrar/recibir webhook de mensajes; un entrante crea/actualiza la conversación, crea contacto al vuelo, incrementa no leídos, respeta la reapertura; la lista filtra por número/estado/asignación; el hilo carga desde Kapso; aislamiento entre organizaciones — **pendiente de verificación en runtime por el usuario**

## Fase 2 — Interacciones de gestión (sin envío)

### 2.1 Servicio
- [x] 2.1.1 `setConversationStatus(ctx, id, status)` (abierta/pendiente/cerrada), org-scoped, `notFound` si no es de la org
- [x] 2.1.2 `assignConversation(ctx, id, userId|null)`: valida que el usuario es miembro de la org; soporta reasignar y desasignar
- [x] 2.1.3 `markRead(ctx, id)`: pone `unread_count=0` y, si `inbox_settings.send_read_receipts`, llama a Kapso para marcar leído el último entrante (✓✓, best-effort)
- [x] 2.1.4 `getInboxSettings(ctx, connectionId)` y `updateInboxSettings(ctx, connectionId, input)` con acción de dominio `org.inbox.configure` (exige `owner/admin`)
- [x] 2.1.5 Schemas: `UpdateStatusInput`, `AssignInput`, `InboxSettingsDto`, `UpdateInboxSettingsInput`, `ConnectionIdParam`

### 2.2 Adaptador Kapso
- [x] 2.2.1 `markMessageRead(phoneNumberId, messageId)` → `POST /meta/.../messages { status: "read", message_id }`

### 2.3 REST API
- [x] 2.3.1 `PATCH /orgs/{orgId}/inbox/conversations/{id}` (estado), `PUT .../{id}/assignment`, `POST .../{id}/read`
- [x] 2.3.2 `GET/PUT /orgs/{orgId}/inbox/numbers/{connectionId}/settings` (lectura miembro, escritura owner/admin)

### 2.4 UI
- [x] 2.4.1 Controles de estado y asignación en el encabezado del hilo; reset de no leídos al abrir la conversación (POST read + revalidación)
- [x] 2.4.2 Diálogo de configuración por número (owner/admin, botón de engranaje): `reopen_behavior` y `send_read_receipts`; copy en español neutral

### 2.5 Verificación Fase 2
- [x] 2.5.1 `pnpm exec tsc --noEmit` y `pnpm lint` sin errores
- [ ] 2.5.2 Verificar (requiere DB): cambiar estado, asignar/reasignar/desasignar y filtros mías/sin asignar/otros; marca de leído según config; edición de settings solo owner/admin — **pendiente de verificación en runtime por el usuario**

## Fase 3 — Envío de servicio + media (R2) + entrega + medición saliente

### 3.1 Storage R2
- [ ] 3.1.1 Añadir variables de entorno de Cloudflare R2 a `web/lib/env.ts` y `env.example` (account id, access key, secret, bucket, base URL pública)
- [ ] 3.1.2 Añadir dependencia S3-compatible (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`) y configurar CORS del bucket
- [ ] 3.1.3 Crear `web/lib/integrations/r2/` con `createPresignedUpload({ contentType, size })` → `{ uploadUrl, publicUrl }` (expiración corta, validación de tipo/tamaño)

### 3.2 Adaptador Kapso (envío)
- [ ] 3.2.1 `sendMessage(phoneNumberId, payload)` → `POST /meta/whatsapp/{phone_number_id}/messages` para text/image/document/audio/video (media por `link`)

### 3.3 Servicio
- [ ] 3.3.1 `sendServiceMessage(ctx, conversationId, input)`: valida ventana 24h (`window.ts`); rechaza fuera de ventana indicando usar plantilla; envía por Kapso; actualiza preview, `last_outbound_at`, `unread_count=0`; `recordMessageUsage(outbound)`
- [ ] 3.3.2 Completar `ingestDeliveryStatus` (Fase 1.3.7) para reflejar `sent|delivered|read|failed` con motivo de error
- [ ] 3.3.3 Schemas: `SendServiceMessageInput` (texto/media), `PresignUploadInput/Response`

### 3.4 REST API
- [ ] 3.4.1 `POST /orgs/{orgId}/inbox/uploads` (presigned) y `POST /orgs/{orgId}/inbox/conversations/{id}/messages` (enviar servicio)

### 3.5 UI
- [ ] 3.5.1 Composer multi-tipo (Texto/Imagen/Documento/Audio/Video) con subida directa a R2 por URL firmada
- [ ] 3.5.2 Bloqueo del envío de servicio fuera de la ventana (UI fuerza plantilla); estados de entrega en el hilo; copy español neutral

### 3.6 Verificación Fase 3
- [ ] 3.6.1 `pnpm lint` y `pnpm build`
- [ ] 3.6.2 Verificar (requiere DB + Kapso + R2): enviar texto y media (incl. archivo > límite de Vercel); rechazo fuera de ventana; progresión de entrega; `usage_event` por mensaje sin doble conteo

## Fase 4 — Plantillas + iniciar conversación desde contactos

### 4.1 Adaptador Kapso
- [ ] 4.1.1 `listTemplates(phoneNumberId|wabaId)` → `GET /meta/whatsapp/.../message_templates` con tipos (nombre, idioma, componentes, variables, tipo de cabecera)

### 4.2 Servicio
- [ ] 4.2.1 `listTemplates(ctx, connectionId)` (lectura en vivo, sin caché) y `sendTemplateMessage(ctx, conversationId, { templateName, language, variables, headerMediaUrl? })`; permitido fuera de ventana; `recordMessageUsage(outbound)`
- [ ] 4.2.2 `startConversation(ctx, { connectionId, contactId|phone, kind })`: aplica la regla de Meta (servicio solo con ventana abierta; si no, plantilla obligatoria); crea/recupera la conversación en el índice
- [ ] 4.2.3 Schemas: `TemplateDto`, `SendTemplateInput`, `StartConversationInput`

### 4.3 REST API
- [ ] 4.3.1 `GET /orgs/{orgId}/inbox/numbers/{connectionId}/templates`, `POST .../conversations/{id}/template`, `POST /orgs/{orgId}/inbox/conversations` (iniciar)

### 4.4 UI
- [ ] 4.4.1 Diálogo de plantilla: selección, llenado de variables, adjunto de media de cabecera (R2 → link)
- [ ] 4.4.2 Acción "Iniciar conversación" desde la lista de contactos y desde el inbox; la UI ofrece servicio/plantilla según la ventana; copy español neutral

### 4.5 Verificación Fase 4
- [ ] 4.5.1 `pnpm lint` y `pnpm build`
- [ ] 4.5.2 Verificar (requiere Kapso + plantillas aprobadas): listar plantillas, enviar con variables y con cabecera de media; iniciar conversación proactiva (solo plantilla) y con ventana abierta (servicio o plantilla)

## Fase 5 — Mensajes interactivos

### 5.1 Adaptador Kapso / Servicio
- [ ] 5.1.1 Extender `sendMessage`/servicio para `type=interactive` (botones de respuesta, listas, CTA URL)
- [ ] 5.1.2 `sendInteractiveMessage(ctx, conversationId, input)` con validación de ventana 24h; schemas de interactivos

### 5.2 UI
- [ ] 5.2.1 Composer de interactivos (botones/listas/CTA) en el menú de adjuntos
- [ ] 5.2.2 Render de respuestas interactivas entrantes en el hilo; copy español neutral

### 5.3 Verificación Fase 5
- [ ] 5.3.1 `pnpm lint` y `pnpm build`
- [ ] 5.3.2 Verificar (requiere Kapso): enviar botones/listas/CTA dentro de ventana; mostrar la respuesta interactiva del cliente

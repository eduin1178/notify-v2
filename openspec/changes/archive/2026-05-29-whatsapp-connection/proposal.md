## Why

Notify necesita operar sobre WhatsApp en nombre de cada organización, pero hoy no existe forma de vincular el número de WhatsApp de un cliente con su organización. Sin este vínculo no hay base para enviar mensajes, notificaciones ni automatizaciones: la conexión de la cuenta es la **primera pieza** sobre la que se apoya todo el producto. Esta es la feature inicial del proyecto.

## What Changes

- **Nueva capability `whatsapp-connection`**: registra y administra las cuentas de WhatsApp de una organización a través de Kapso (BSP), cubriendo el ciclo de vida completo.
- **Onboarding por setup link**: un usuario `owner`/`admin` genera un enlace de Kapso; el cliente completa el embedded signup de Meta y el número queda vinculado a la organización.
- **Detección robusta de conexión**: se reciben los webhooks de proyecto `whatsapp.phone_number.created` (fuente de verdad) y `whatsapp.phone_number.deleted`, complementados con el redirect de éxito/fallo para la experiencia inmediata.
- **Ciclo de vida completo**: conectar, listar, ver estado, **desconectar** (eliminación en Kapso confirmada por `whatsapp.phone_number.deleted`) y **reconectar** (setup link con `reconnect_phone_number`).
- **Autorización por rol**: nueva acción de dominio `org.whatsapp.connect` — solo `owner`/`admin` de la organización pueden conectar, desconectar o reconectar.
- **Gating por plan**: el número de cuentas conectadas se limita con el entitlement **existente** `whatsapp_numbers` (no se introduce gating nuevo).
- **Persistencia mínima y segura**: nueva tabla `whatsapp_connection` (1 organización → N conexiones) y columna `kapso_customer_id` en `organization`. **No se almacenan tokens de Meta** — Kapso custodia las credenciales; Notify solo guarda identificadores.
- **Cliente de integración Kapso (Platform API)**: adaptador tipado fino sobre `fetch` para `/platform/v1` (customers, setup_links). El SDK oficial `@kapso/whatsapp-cloud-api` queda reservado para la futura capa de mensajería; **no aplica** a la conexión.

## Capabilities

### New Capabilities
- `whatsapp-connection`: vinculación y administración del ciclo de vida de las cuentas de WhatsApp a nivel de organización vía Kapso (onboarding por setup link, detección por webhook + redirect, listar, estado, desconectar, reconectar), con autorización owner/admin y gating por `whatsapp_numbers`.

### Modified Capabilities
<!-- Ninguna. La acción de autorización `org.whatsapp.connect`, la columna `kapso_customer_id` y el consumo del entitlement `whatsapp_numbers` son detalles de implementación introducidos POR esta capability; no cambian los requisitos de las capabilities `auth`, `organizations` ni `billing`. -->

## Impact

- **Base de datos**: nueva tabla `whatsapp_connection`; nueva columna `organization.kapso_customer_id`; migración Drizzle (`web/lib/db/schema.ts` → `web/drizzle/migrations/`).
- **Capa de servicios**: nuevo dominio `web/lib/services/whatsapp/` (`service.ts`, `schemas.ts`) con `TenantServiceContext` y `DomainErrors`.
- **Autorización**: nueva acción `org.whatsapp.connect` en `web/lib/auth/permissions.ts`.
- **REST API**: nuevas rutas tenant-scoped bajo `/api/v1/orgs/:orgId/whatsapp/...` (Hono + `@hono/zod-openapi`).
- **Webhook**: nueva ruta dedicada FUERA de `/api/v1` (sin sesión, como el handler de better-auth) con verificación de firma e idempotencia.
- **Integración externa**: nuevo adaptador Kapso Platform API (cliente `fetch` tipado).
- **Configuración**: nuevas variables en `web/lib/env.ts` (`KAPSO_API_KEY`, `KAPSO_API_BASE_URL`, secreto de verificación del webhook).
- **Billing**: consumo (lectura) del entitlement `whatsapp_numbers` ya existente; sin cambios en su definición.
- **Fuera de alcance**: disparo automático de `needs_reconnect` (listener de `whatsapp.message.failed`), envío de mensajes, plantillas, flows y embeds de inbox.

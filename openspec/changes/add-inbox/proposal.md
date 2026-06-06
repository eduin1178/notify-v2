## Why

Notify ya puede vincular números de WhatsApp a una organización ([[whatsapp-connection]]) y administrar a quién contactar ([[contacts]]), pero todavía **no puede conversar**. El Inbox es la pieza operativa donde los agentes realmente trabajan: reciben, leen y responden mensajes de los clientes a través de los distintos números de la organización. Es el corazón del producto — todo lo construido hasta ahora (conexión, contactos, billing seam) existe para habilitar esta superficie.

El feature pedido ([openspec/features.md](../../features.md), sección **Inbox**) cubre conversaciones con estado, la ventana de 24 horas de Meta, plantillas con variables y media, asignación de agentes, inicio de conversación desde contactos, selección de número como filtro principal y envío de texto, imagen, documento, audio y video. El [mockup de referencia](./assets/inbox-mockup.md) fija el layout objetivo y forma parte del requerimiento.

El hallazgo que define la arquitectura: **Kapso no es solo un caño de envío, es un almacén completo de conversaciones**. Su Platform API v1 ya expone listado de conversaciones (con filtros y cursor), historial de mensajes, media alojado, y webhooks de mensajes/conversaciones. Por tanto el diseño NO reimplementa mensajería: decide **qué es fuente de verdad de qué**.

## What Changes

- **Nueva capability `inbox`**: bandeja de conversaciones por organización y por número, con recepción en tiempo (casi) real, envío multi-tipo, estados de negocio, asignación a agentes y cumplimiento de la ventana de 24h de Meta.
- **Arquitectura híbrida (decisión central)**: Notify es dueño de un **índice local** (una fila por conversación con estado, asignación, contacto enlazado, ventana 24h y preview denormalizado); Kapso sigue siendo dueño de los **mensajes y el media**, que se leen por **read-through**. Razón: el estado de negocio (3 estados) y la asignación a agentes Notify no existen en Kapso (Kapso solo tiene `active`/`ended` y asigna a *project members*, que no son nuestros usuarios), así que la lista filtrable por esos ejes DEBE servirse desde nuestra DB.
- **Recepción por webhook**: se extiende la ruta existente `app/api/webhooks/kapso/route.ts` (firma + idempotencia ya resueltas) para los eventos `whatsapp.message.received|sent|delivered|read|failed` y `whatsapp.conversation.created|ended|inactive`. Cada entrante hace *upsert* del índice, actualiza la ventana de 24h, incrementa no leídos, aplica la reapertura configurable y, si el contacto no existe, lo **crea al vuelo** (`source=whatsapp`).
- **Estados de negocio (req 1)**: `abierta | pendiente | cerrada`, **propios de Notify** e independientes de Kapso. "Pendiente" es **manual**. La reapertura ante un entrante es **configurable por número**.
- **Ventana de 24h (req 2)**: derivada de `last_inbound_at`. Fuera de la ventana se **bloquea el mensaje de servicio** y se **fuerza plantilla**; dentro, el servicio es libre. Defensa en profundidad (Meta también rechaza).
- **Envío (req 3, 7)**: texto, imagen, documento, audio y video + **plantillas** (selección, variables y media de cabecera) + **interactivos** (botones/listas/CTA), vía el proxy de Meta de Kapso. El media saliente sube **directo del navegador a Cloudflare R2** (subida firmada) para sortear el límite de body de Vercel, y se envía a Kapso por `link`.
- **Asignación a agentes (req 4)**: `assigned_user_id` → usuario de Notify, con filtros **Mis conversaciones / Sin asignar / Otros**.
- **Selector de número (req 6)**: filtro principal; el inbox muestra **siempre un número** (default: el primero conectado).
- **Iniciar desde contactos (req 5)**: desde la lista de contactos; la UI **impone la política de Meta** (servicio solo si hay ventana abierta; si no, plantilla obligatoria).
- **Medición de uso**: se registra `usage_event` por **todo mensaje** (entrante + saliente, plantilla + servicio), deduplicado por **WAMID**, para cobro posterior; además una métrica de **conversaciones** (ventanas de 24h) solo para analítica. El inbox **nunca bloquea por cupo** — el control de límite lo hará el engine de cobro futuro.
- **Configuración por número (`inbox_settings`)**: tabla nueva con `reopen_behavior` y `send_read_receipts`, editable por **owner/admin**.

**Entrega en 5 fases** (cada una es un slice revisable por PR dentro del presupuesto cognitivo de ~400 líneas):
1. Índice + recepción por webhook + navegación (lectura): tablas, ingestión, contacto al vuelo, selector de número, lista con filtros, hilo read-through, ventana 24h y no leídos.
2. Interacciones de gestión: cambiar estado, asignar agente, marcar leído + read receipts, UI de `inbox_settings`.
3. Envío de servicio + media (R2) + estados de entrega + medición de uso.
4. Plantillas + iniciar conversación desde contactos (con regla de ventana).
5. Mensajes interactivos (botones/listas/CTA) y render de interactivos entrantes.

## Capabilities

### New Capabilities
- `inbox`: bandeja de conversaciones por organización y por número sobre WhatsApp vía Kapso — recepción por webhook con índice local, hilo de mensajes read-through, estados de negocio (abierta/pendiente/cerrada), asignación a agentes Notify con filtros, cumplimiento de la ventana de 24h, envío de texto/imagen/documento/audio/video + plantillas + interactivos, inicio de conversación desde contactos, contacto al vuelo, medición de uso por mensaje, y configuración por número (`inbox_settings`).

### Modified Capabilities
<!-- Ninguna spec existente cambia sus requisitos. La extensión del webhook de Kapso para eventos de mensaje/conversación, la suscripción automática de webhook number-scoped al conectar un número, la lectura de `whatsapp_connection` para resolver el número, el enlace a `contact` y la emisión de `usage_event` son detalles de implementación introducidos POR esta capability; no alteran los requisitos de `whatsapp-connection`, `contacts`, `billing` ni `rest-api`. -->

## Impact

- **Base de datos**: nuevas tablas `conversation` (índice) e `inbox_settings` (config por número); migración Drizzle (`web/lib/db/schema.ts` → `web/drizzle/migrations/`). Aditiva.
- **Capa de servicios**: nuevo dominio `web/lib/services/inbox/` (`service.ts`, `schemas.ts`, helpers de ventana 24h y medición) con `TenantServiceContext` y `DomainErrors`, módulo puro (sin `next/*` ni `hono`).
- **REST API**: nuevas rutas tenant-scoped bajo `/api/v1/orgs/:orgId/inbox/...` (Hono + `@hono/zod-openapi`), reutilizando los schemas del servicio.
- **Webhook**: se extiende la ruta existente `app/api/webhooks/kapso/route.ts` con los eventos de mensaje/conversación (firma e idempotencia ya existentes; dedup adicional por WAMID).
- **Integración externa**: se extiende el adaptador Kapso (`web/lib/integrations/kapso/`) con envío de mensajes (proxy Meta), listado de mensajes/conversaciones (Platform v1), listado de plantillas, marca de leído y registro de webhook number-scoped para eventos de mensaje.
- **Storage de blobs**: nuevo adaptador Cloudflare R2 (`web/lib/integrations/r2/`) con subida directa firmada (presigned) y URL pública para el `link` de envío.
- **UI**: nueva sección `app/(app)/org/[orgSlug]/inbox/` (tres columnas: lista, hilo, contexto) + composer multi-tipo + diálogo de plantillas + acción "Iniciar conversación" desde contactos + UI de configuración por número.
- **Configuración**: nuevas variables en `web/lib/env.ts` (credenciales y bucket de Cloudflare R2, base URL pública; base del proxy Meta de Kapso si no existe). Reutiliza `KAPSO_API_KEY` y `KAPSO_WEBHOOK_SECRET`.
- **Billing**: emisión (escritura) de `usage_event` por mensaje y conversación; **sin gating** por cupo en el inbox. No se modifica la definición de entitlements.
- **Realtime**: **decisión abierta** (ver `design.md`, Open Questions). v1 puede arrancar con polling sobre el índice local; el modelo soporta polling o push sin recableado.
- **Fuera de alcance**: citar mensajes (quoted replies) y reacciones (envío y render), tickets, "transferir" como flujo formal, automatización/workflows de Kapso, sincronización de un espejo completo de mensajes para búsqueda full-text, auto-asignación, auto-cierre por inactividad y horarios de atención (la config por número nace con un solo eje + read receipts).

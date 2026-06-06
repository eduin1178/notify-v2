## Context

Notify es multi-tenant: la organización del path (`/api/v1/orgs/:orgId/...`) es la fuente única de verdad para REST. La arquitectura separa dominio (`web/lib/services/`) de transporte (rutas Hono y Server Components/Actions), con `TenantServiceContext` inyectando `db`, `currentOrg`, `entitlements`, `usage`. Los servicios son módulos puros: NO importan `next/*` ni `hono`. Los errores de dominio se lanzan con `DomainErrors.{unauthorized,forbidden,notFound,conflict,validation}` y el handler global los traduce a HTTP. Los schemas de input/output viven en `lib/services/<dominio>/schemas.ts` y se reutilizan en `createRoute(...)`.

Esta capability se apoya en piezas ya existentes:
- `whatsapp_connection` (1 org → N conexiones), con `phone_number_id` y `display_phone_number` por conexión `connected`. El inbox resuelve el número por `phone_number_id → whatsapp_connection → org`.
- `contact` (teléfono E.164 único por org). La conversación enlaza a un contacto por teléfono; si no existe, se crea al vuelo.
- Webhook de Kapso `app/api/webhooks/kapso/route.ts` con verificación de firma HMAC y idempotencia DB-backed (`whatsapp_webhook_event`). Se EXTIENDE, no se reescribe.
- Adaptador Kapso `web/lib/integrations/kapso/` (cliente `fetch` tipado, `KAPSO_API_KEY`).
- Billing seam: tabla `usage_event` (ledger) y ports de `entitlements`/`usage` en `ctx`.

**Superficies de Kapso relevantes (verificado en docs de Kapso):**
- **Platform API v1** (`/whatsapp/...`, header `X-API-Key`):
  - `GET /whatsapp/conversations` — filtros (`phone_number_id`, `phone_number`, `status` active|ended, `assigned_user_id`, `unassigned`, rangos de fecha), cursor pagination, ordenado por actividad reciente. Devuelve `kapso.{contact_name, messages_count, last_message_text, last_message_timestamp, last_inbound_at, last_outbound_at}`.
  - `GET /whatsapp/messages` — historial por `conversation_id` (cursor, newest-first), payload Meta-compatible + `kapso.{direction, status, media_url, media_data, transcript, content}`.
  - `PATCH /whatsapp/conversations/{id}` — status `active|ended` (NO se usa como autoridad).
  - Asignación nativa (`/assignments`) — **NO se usa**: asigna a *project members* de Kapso, no a usuarios Notify.
- **Meta proxy** (`/meta/whatsapp/{phone_number_id}/...`, header `X-API-Key`):
  - `POST /messages` — enviar text/image/video/audio/document/sticker/location/interactive/template/reaction. Media por `link` (URL pública) o `id` (media subido).
  - `GET /message_templates` (por WABA) — listar plantillas aprobadas.
  - marca de leído (`messages` con `status: read`).
- **Webhooks number-scoped** (`POST /whatsapp/phone_numbers/{id}/webhooks`, kind=`kapso`): eventos `whatsapp.message.*` y `whatsapp.conversation.*`, con buffering opcional.

## Goals / Non-Goals

**Goals:**
- Bandeja de conversaciones por organización y por número, con recepción (casi) en vivo y envío multi-tipo.
- Estados de negocio propios (abierta/pendiente/cerrada) y asignación a agentes Notify, con los filtros del mockup.
- Cumplimiento estricto de la ventana de 24h de Meta para mensajes de servicio.
- Medición de uso por todo mensaje (in+out) para cobro, sin bloquear por cupo.
- Reutilizar al máximo el almacén de Kapso (mensajes/media) y NO duplicar contenido en v1.
- Respetar la separación dominio/transporte y los patrones existentes (servicios puros, `DomainErrors`, zod-openapi, copy en español neutral).

**Non-Goals:**
- Espejo completo de mensajes en nuestra DB / búsqueda full-text del cuerpo (puerta abierta a futuro).
- Citar mensajes (quoted replies) y reacciones (envío y render).
- Tickets, "transferir" como flujo formal, automatización/workflows de Kapso.
- Auto-asignación, auto-cierre por inactividad, horarios de atención (la config por número nace mínima).
- Gating del inbox por cupo de plan (lo hará el engine de cobro futuro).

## Decisions

### D1. Arquitectura híbrida: índice local + mensajes read-through
Notify guarda **una fila por conversación** (`conversation`) con el estado de negocio, la asignación, el enlace al contacto, la ventana de 24h y campos denormalizados de preview. Los **mensajes y el media** se leen de Kapso por read-through (`GET /whatsapp/messages?conversation_id=...`). NO se crea tabla `message` en v1.
- **Por qué**: dos requisitos chocan con el modelo de Kapso. (a) **Estados**: Kapso solo tiene `active|ended`; el feature pide 3 (abierta/pendiente/cerrada). (b) **Asignación**: Kapso asigna a *project members* (usuarios de la plataforma Kapso), pero nuestros agentes son usuarios Notify (better-auth) y todas las orgs comparten un único proyecto/`KAPSO_API_KEY`; mapearlos sería cross-tenant. Como estado y asignación son nuestros, la lista filtrable por esos ejes NO se puede resolver llamando a Kapso → el índice DEBE ser local.
- **Beneficio**: toda la columna izquierda del mockup (número, estado, asignación, no leídos, orden) se pinta con **una query local** filtrable; el hilo central siempre lee el contenido fresco de Kapso; cero duplicación de contenido.
- **Alternativas descartadas**: *Espejo total* (duplicar mensajes) → sincronía frágil y reimplementar Kapso; *Read-through puro* (nada local) → imposible filtrar por nuestro estado/asignación.

### D2. Recepción por webhook que hace upsert del índice
Se extiende `app/api/webhooks/kapso/route.ts` con `whatsapp.message.received|sent|delivered|read|failed` y `whatsapp.conversation.created|ended|inactive`. En `received`: resolver `phone_number_id → whatsapp_connection → org`; resolver/crear el `contact` por teléfono; *upsert* de `conversation` por `kapso_conversation_id` (UNIQUE) actualizando `last_inbound_at` (reinicia ventana 24h), `last_message_*`, `unread_count++` y aplicando la reapertura configurable; emitir `usage_event` (dedup por WAMID). En `sent|delivered|read|failed`: actualizar el estado de entrega del último saliente.
- **Por qué**: el webhook ya tiene firma e idempotencia; extender el `switch` es aditivo y mantiene una sola puerta de entrada de eventos de Kapso.
- **Sin buffer**: el webhook number-scoped se registra **sin buffering** (latencia de atención manda sobre el ahorro de invocaciones). El volumen se absorbe con upsert idempotente.

### D3. Suscripción automática a eventos de mensaje por número
Cuando llega `whatsapp.phone_number.created` (conexión exitosa), además de promover la conexión a `connected`, se registra en Kapso un webhook **number-scoped** (`kind=kapso`, `buffer_enabled=false`, eventos de mensaje/conversación, mismo `secret_key`) apuntando a `/api/webhooks/kapso`. Idempotente (no duplicar si ya existe).
- **Por qué**: sin webhook number-scoped no llegan eventos de mensaje. Automatizarlo al conectar evita configuración manual por número y mantiene el contrato "conectar = listo para conversar".
- **Alternativa descartada**: configurar el webhook a mano en el dashboard de Kapso → frágil y no reproducible.

### D4. Estados de negocio propios, independientes de Kapso
`conversation.notify_status ∈ {abierta, pendiente, cerrada}`. Se inicializa en `abierta`. **Pendiente es manual** (lo marca el agente). NO se sincroniza con el `status` de Kapso (`active|ended`): Kapso queda como informativo.
- **Por qué**: el feature define una semántica de negocio que Kapso no modela; tener una sola autoridad (Notify) evita *drift* entre dos fuentes.
- **Pendiente manual**: automatizar "pasa a pendiente cuando el agente responde" impondría una semántica rígida; manual es predecible y flexible. La automatización se puede añadir después sin romper el modelo.

### D5. Reapertura ante entrante, configurable por número
Cuando llega un entrante a una conversación `cerrada`, el comportamiento lo define `inbox_settings.reopen_behavior ∈ {reopen_keep_agent, reopen_unassign, stay_closed}`, **por número**. Default: `reopen_keep_agent` (reabre a `abierta` conservando `assigned_user_id`).
- **Por qué (directiva explícita)**: distintos números/operaciones quieren distinto comportamiento; el default seguro evita perder mensajes del cliente.

### D6. Ventana de 24h derivada de `last_inbound_at`
La ventana cierra en `last_inbound_at + 24h`. El gating del envío de servicio se evalúa en el dominio (`lib/services/inbox/`) **sin llamar a Kapso** (dato local). Dentro de la ventana: texto/media libres. Fuera: se rechaza el servicio (`DomainErrors.conflict`/`forbidden`) y la UI fuerza plantilla. Una conversación **proactiva nueva** (sin `last_inbound_at`) NO tiene ventana abierta → solo plantilla.
- **Por qué**: política de Meta no negociable. Derivarlo localmente da respuesta inmediata en la UI (badge "08h 24m restantes"); Meta/Kapso rechazan también si nos equivocamos (defensa en profundidad).

### D7. Medición de uso por todo mensaje; sin gating por cupo
Se emite `usage_event` por **cada mensaje** entrante y saliente (plantilla y servicio), con métrica `message`, deduplicado por **WAMID** (id de Meta) para no contar doble ante reentregas/batches. Además, métrica `conversation` por cada apertura de ventana de 24h, **solo para analítica**. El inbox **no niega envíos por cupo**.
- **Por qué (directiva explícita)**: el cobro cuenta todo mensaje. Pero **limitar con entrantes es inviable** (no se puede rechazar lo que Meta ya entregó; ocultarlo es peor) y haría depender el costo de algo que el cliente no controla. Por eso: medir todo, limitar nada en el inbox; el cap lo aplicará el engine de cobro.
- **Dedup por WAMID**: la idempotencia por `X-Idempotency-Key` cubre el evento; el WAMID cubre el mensaje (un batch trae varios WAMID bajo una entrega).

### D8. Asignación a usuarios Notify, con filtros mías/sin asignar/otros
`conversation.assigned_user_id` → `user`. Filtros: `assigned_user_id = me` (Mis), `IS NULL` (Sin asignar), `<> me AND NOT NULL` (Otros). Cualquier `member` puede asignar/reasignar.
- **Por qué**: los agentes son usuarios Notify; la asignación nativa de Kapso no aplica (D1). Es dato operativo, no configuración → membresía basta.

### D9. Selector de número: siempre uno, default el primero conectado
El inbox muestra siempre las conversaciones de UN `whatsapp_connection`. No hay vista "Todos" en v1.
- **Por qué**: coincide con el mockup, simplifica las queries, el orden y la regla de "desde qué número respondo". La vista agregada queda como extensión futura.

### D10. Envío vía proxy Meta de Kapso; media saliente por Cloudflare R2 (subida directa)
Enviar usa `POST /meta/whatsapp/{phone_number_id}/messages` (header `X-API-Key`). El media saliente se sube **directo del navegador a R2** mediante URL firmada (presigned PUT), y se envía a Kapso por `link` con la URL pública de R2.
- **Por qué**: el límite de body de funciones serverless de Vercel (~4.5 MB) impide subir media grande a través de nuestra API (el propio mockup tiene un video de 5.6 MB; documentos hasta 100 MB). La subida directa navegador→R2 sortea el límite; enviar por `link` evita gestionar `id` efímeros de Meta. Subir a Kapso requiere API key → no se puede desde el navegador → descartado para archivos grandes.
- **Recepción de media**: trivial, se usa el `media_url` que Kapso ya aloja (read-through). No requiere R2.
- **Alternativa descartada**: bucket distinto (S3/Vercel Blob) — válida; se eligió **R2** por costo (sin egreso) y compatibilidad S3.

### D11. Contacto al vuelo en entrantes desconocidos
Si un entrante viene de un teléfono que no existe en `contact`, se crea (`source=whatsapp`, teléfono E.164, `first_name = profile_name`). La conversación siempre queda enlazada al CRM.
- **Por qué**: el agente ve siempre una ficha; puede completar datos luego. Reutiliza la unicidad `(org, phone)` existente (idempotente).

### D12. Read receipts configurables por número
Al abrir/leer una conversación, `unread_count → 0` (local, siempre). Enviar el "visto" (✓✓ azul) a WhatsApp depende de `inbox_settings.send_read_receipts` (default `true`).
- **Por qué**: algunas operaciones quieren transparencia (check azul), otras no revelar que leyeron sin responder. Default ON por transparencia.

### D13. `inbox_settings` como tabla dedicada por número (owner/admin)
Tabla `inbox_settings` con `UNIQUE(whatsapp_connection_id)`: `reopen_behavior`, `send_read_receipts`. La editan **owner/admin** (acción de dominio); `member` la lee.
- **Por qué**: separa "¿está conectado el número?" (`whatsapp_connection`) de "¿cómo se comporta su inbox?" (`inbox_settings`); evoluciona a ritmo distinto. Nace mínima (dos campos) por disciplina de alcance.

### D14. Alcance de tipos de mensaje
**Enviar** (v1): texto, imagen, documento, audio, video, plantillas e **interactivos** (botones/listas/CTA). **Recibir/mostrar**: todos los tipos que Kapso entregue (ubicación, interactivos, etc.) con render básico; tipos no soportados muestran un fallback legible. **Diferido**: citar mensajes y reacciones (envío y render).

## Risks / Trade-offs

- **Latencia del read-through** → abrir un hilo depende de la API de Kapso. Mitigación: el preview de la lista es local (instantáneo); el hilo pagina por cursor y cachea en cliente. Si molesta, se evalúa espejo de mensajes (puerta abierta de D1).
- **Drift índice ↔ Kapso** → si se pierde un webhook, el preview local puede quedar desfasado. Mitigación: al abrir el hilo se reconcilia con `GET /messages` (Kapso manda en contenido); job de reconciliación periódica como mejora futura.
- **Conteo de uso doble** → reentregas/batches de Kapso. Mitigación: dedup por WAMID además de `X-Idempotency-Key`.
- **Límite de body de Vercel** → resuelto por subida directa a R2 (D10); requiere CORS y URLs firmadas bien acotadas (expiración corta, `Content-Type`/tamaño validados).
- **Ventana 24h en frontera** → relojes y redondeo. Mitigación: el dominio decide con margen y Meta es la autoridad final (defensa en profundidad, D6).
- **Realtime no decidido** → ver Open Questions. v1 con polling no bloquea nada; el modelo soporta cambiar a push después sin tocar el esquema.
- **BSUID-only (sin teléfono)** → Meta puede enviar identidad sin `phone_number`/`wa_id`. Mitigación: la conversación puede existir sin `contact_id`; el contacto al vuelo solo se crea cuando hay teléfono normalizable.

## Migration Plan

1. Añadir tablas `conversation` e `inbox_settings` a `web/lib/db/schema.ts` con sus índices/uniques; generar migración (`pnpm db:generate`) y verificar el SQL. Aditiva y compatible hacia atrás.
2. Añadir variables de entorno de Cloudflare R2 a `web/lib/env.ts` y `env.example` (account id, access key, secret, bucket, base URL pública) y, si falta, la base del proxy Meta de Kapso. Reutiliza `KAPSO_API_KEY` y `KAPSO_WEBHOOK_SECRET`.
3. Añadir dependencia de cliente S3-compatible para R2 (p. ej. `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`) y CORS del bucket.
4. Registrar/garantizar el webhook number-scoped de mensajes para los números ya conectados (D3); para nuevos números se registra automáticamente al conectar.
5. Rollback: aditivo; revertir = quitar rutas/servicio/UI y, si se desea, drop de tablas. Sin datos de producción que migrar.

## Phasing (delivery)

Cada fase es un slice revisable por PR independiente (work-unit commits), dentro del presupuesto de ~400 líneas. Cada fase deja la app funcional.

| Fase | Alcance | Entregable |
|------|---------|------------|
| **1** | Esquema `conversation` + `inbox_settings` + extensión webhook (recepción + upsert + contacto al vuelo + reapertura + medición de entrantes) + servicio lectura + REST GET + UI tres columnas (selector de número, lista con filtros, hilo read-through, badge 24h, no leídos) | Inbox de **lectura** funcionando de punta a punta |
| **2** | Cambiar estado (abierta/pendiente/cerrada) + asignar agente (mías/sin asignar/otros) + marcar leído + read receipts + UI de `inbox_settings` (owner/admin) | Gestión de conversaciones |
| **3** | Adaptador R2 (presigned) + envío servicio (texto + imagen/doc/audio/video) + gating 24h + estados de entrega (sent/delivered/read/failed) + medición de salientes | Conversar dentro de la ventana |
| **4** | Listar plantillas (Kapso) + llenar variables + media de cabecera (R2) + enviar plantilla + iniciar conversación desde contactos (regla de ventana) | Plantillas y proactivo |
| **5** | Enviar interactivos (botones/listas/CTA) + render de interactivos entrantes | Interactivos |

Las fases 2-5 dependen del modelo y los patrones que fija la fase 1.

## Open Questions

- **Realtime (ABIERTA)**: ¿polling con SWR sobre el índice local (simple, serverless-friendly, "casi vivo"), push con servicio externo (Pusher/Ably/Supabase Realtime) o SSE en route handler (frágil con timeouts de Vercel)? El modelo de datos soporta cualquiera sin recableado; se recomienda **polling en v1** y reevaluar con feedback. **A decidir antes de la Fase 1 (UI) o como ajuste incremental.**

Resueltas para este cambio:
- ~~¿Fuente de verdad de mensajes?~~ → **Híbrido**: índice local + read-through (D1).
- ~~¿3 estados vs los 2 de Kapso?~~ → estados propios independientes (D4).
- ~~¿Asignación nativa de Kapso?~~ → no; asignación a usuarios Notify (D8).
- ~~¿"Pendiente" auto o manual?~~ → **manual** (D4).
- ~~¿Reapertura ante entrante?~~ → **configurable por número**, default `reopen_keep_agent` (D5).
- ~~¿Facturar/limitar?~~ → medir todo por WAMID; **sin gating** en el inbox (D7).
- ~~¿Unidad de uso?~~ → por **mensaje** (cobro) + métrica de **conversación** (analítica) (D7).
- ~~¿Media saliente?~~ → **Cloudflare R2** con subida directa firmada → enviar por `link` (D10).
- ~~¿Contacto al vuelo?~~ → **sí**, `source=whatsapp` (D11).
- ~~¿Read receipts?~~ → **configurable por número**, default ON (D12).
- ~~¿Buffering del webhook?~~ → **sin buffer** (D2).
- ~~¿Selector de número?~~ → **siempre uno**, default el primero (D9).
- ~~¿Alcance de tipos?~~ → enviar 5 tipos + plantillas + interactivos; recibir todos con fallback; citar/reacciones diferidos (D14).

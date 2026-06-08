## Context

El inbox se mantiene con polling SWR de 4s ([inbox-client.tsx:206](web/components/app/inbox-client.tsx#L206),
[241](web/components/app/inbox-client.tsx#L241)). Los datos nacen en el webhook de Kapso
([webhooks/kapso/route.ts](web/app/api/webhooks/kapso/route.ts)) que llama a
`ingestInboundMessage` / `ingestDeliveryStatus` de
[service.ts](web/lib/services/inbox/service.ts) (capa pura). La REST API es Hono +
`@hono/zod-openapi` bajo `/api/v1/`, con `requireSession` y `requireOrgMembership`
ya disponibles. La app corre en Next 16 (serverless), por lo que NO puede sostener
un socket server propio: Centrífugo v6.8.1 es infra aparte y el patrón correcto es
"navegador ↔ WS de Centrífugo" + "backend → HTTP API de Centrífugo".

API de Centrífugo v6 verificada (Context7):
- **Publicar**: `POST {CENTRIFUGO_API_URL}/api/publish`, header `X-API-Key: <key>`,
  body `{"channel": "...", "data": {...}}`. La key corresponde a `http_api.key`.
- **Tokens**: JWT HS256 firmados con `client.token.hmac_secret_key`. Conexión:
  claims `{sub, exp}`. Suscripción: claims `{sub, channel, exp}`.
- **Privacidad de namespace**: si el namespace `inbox` NO activa
  `allow_subscribe_for_client`, toda suscripción exige subscription token (modelo
  seguro por defecto). El `#` en el nombre de canal está reservado para canales
  limitados por user-id → lo evitamos.

Restricciones del proyecto: `lib/services/` es pura (sin `next/*`, sin Hono, sin
SDKs de I/O); todo I/O entra por `ctx`/deps. Copy en español neutro.

## Goals / Non-Goals

**Goals:**
- Push en near-real-time de entrantes, salientes y estados de entrega.
- Aislamiento multi-tenant estricto por tokens de suscripción.
- Mantener la capa de servicios pura mediante un puerto `RealtimePublisher`.
- Degradar con gracia a polling de respaldo si el realtime no está disponible.

**Non-Goals:**
- Unificación de hilos por número (idea pendiente; afecta qué `conv.<id>` recibe el
  evento, pero se resuelve aparte).
- Presence/quién-está-escribiendo, historial server-side de Centrífugo, recovery
  avanzado (se puede añadir luego; este change usa publish efímero + revalidación).
- Reemplazar el read-through de Kapso: el evento es una **señal**, los datos siguen
  viniendo de la API/SWR.

## Decisions

### D1 — Puerto `RealtimePublisher` en servicios, adaptador en integraciones
Interfaz mínima en la capa pura: `publish(channel: string, data: unknown): Promise<void>`.
Se añade `realtime: RealtimePublisher` al `ServiceContext`/deps. El adaptador real
vive en `web/lib/integrations/centrifugo/publisher.ts` (hace el `POST /api/publish`).
El webhook y las rutas construyen el `ctx` con el adaptador real; las pruebas usan
un no-op. Respeta las reglas 1–4 del proyecto (servicios puros, ctx explícito,
adaptadores delgados).
**Alternativa descartada**: `fetch` a Centrífugo dentro de `service.ts` → viola la
pureza de la capa.

### D2 — Publicar DESPUÉS del commit, best-effort
La publicación ocurre tras `ingestInboundMessage` / `ingestDeliveryStatus` ya
confirmados. Un fallo de publish NO debe propagarse (no forzar 500 → reintentos de
Kapso): se captura y se loguea. Patrón idéntico al `try/catch` local de
`ensureMessageWebhook` ([route.ts:131-144](web/app/api/webhooks/kapso/route.ts#L131-L144)).
**Alternativa descartada**: publicar dentro de la transacción → acopla durabilidad
de BD a disponibilidad de Centrífugo.

### D3 — Dónde se origina el publish
Dos opciones: (a) el webhook orquesta el publish leyendo el resultado del ingest;
(b) el servicio llama a `ctx.realtime.publish` internamente. Elegimos **(b)**: el
servicio ya tiene el `orgId`/`conversationId` y el payload; pasar el puerto por
`ctx` mantiene la lógica de "qué se publica" junto a la de dominio, sin I/O directo.
El webhook solo provee el adaptador en el `ctx`. Las rutas de envío también pueden
publicar por la misma vía para eco inmediato entre agentes (opcional en tasks).

### D4 — Canales y namespace
Namespace `inbox` (config en Centrífugo, fuera del repo salvo documentación).
Canales `inbox:org.<orgId>` e `inbox:conv.<conversationId>`. Sin `#`. El scoping se
garantiza por subscription token, no por el nombre. El payload de cada publish lleva
un `type` discriminado (p. ej. `message.new`, `delivery.update`, `conversation.upsert`)
para que el cliente sepa qué revalidar.

### D5 — Emisión de tokens (JWT HS256 con `jose`)
Dos endpoints REST nuevos bajo `/api/v1/`:
- `POST /api/v1/realtime/connection-token` (solo `requireSession`): devuelve
  `{token}` con claims `{sub: userId, exp}`.
- `POST /api/v1/orgs/:orgId/realtime/subscription-token` (`requireSession` +
  `requireOrgMembership`): valida que el `channel` solicitado pertenece a `:orgId`
  (prefijo `inbox:org.<orgId>` o `inbox:conv.<id>` cuya conversación es de esa org)
  y devuelve `{token}` con claims `{sub, channel, exp}`.
Firmado con `CENTRIFUGO_TOKEN_HMAC_SECRET` vía `jose` (ya presente en el árbol por
better-auth; se promueve a dependencia directa). Expiraciones cortas (p. ej. 5–10
min); `centrifuge-js` re-pide token al expirar mediante `getToken`.
**Alternativa descartada**: firmar con `node:crypto` a mano → factible (el webhook
ya usa `node:crypto`) pero `jose` es más claro y seguro para JWT.
**Validación de canal de conversación**: para `inbox:conv.<id>` se verifica que la
conversación pertenezca a la org del path antes de emitir (consulta al índice
local), evitando que un miembro de la org adivine ids de otra org.

### D6 — Cliente `centrifuge-js`
Una sola instancia `Centrifuge(NEXT_PUBLIC_CENTRIFUGO_WS_URL, { getToken })` a nivel
de `InboxClient`. Suscripción a `inbox:org.<orgId>` del número activo (vive mientras
el inbox esté montado) y a `inbox:conv.<id>` de la conversación abierta (se re-suscribe
al cambiar de conversación). En `publication` → `mutate(conversationsKey)` y/o
`mutate(messagesKey)` según el `type` del payload. La conexión y suscripciones se
limpian en el cleanup del efecto. Respeta el lint de efectos del proyecto.

### D7 — Polling de respaldo
`refreshInterval` baja de 4000 a ~30000–60000 ms. Se mantiene
`revalidateOnFocus`/`revalidateOnReconnect` de SWR, y en el evento de reconexión del
WS se fuerza `mutate`. Si no hay `NEXT_PUBLIC_CENTRIFUGO_WS_URL` o la conexión falla
de forma persistente, el inbox sigue con el fallback (degradación con gracia).

### D8 — Dependencias y entorno
Añadir `centrifuge` (cliente) y promover `jose` a dependencia directa. Variables en
[env.ts](web/lib/env.ts): `CENTRIFUGO_API_URL`, `CENTRIFUGO_API_KEY`,
`CENTRIFUGO_TOKEN_HMAC_SECRET` (server, requeridas si se activa realtime),
`NEXT_PUBLIC_CENTRIFUGO_WS_URL` (cliente). Para no romper arranques sin Centrífugo,
se modelan como **opcionales** y el realtime se activa solo si están presentes
(igual que el patrón opcional de R2).

## Risks / Trade-offs

- **Doble fuente de actualización (push + SWR)** → posible carrera/parpadeo.
  **Mitigación**: el push solo dispara `mutate` (revalida), no escribe datos
  directamente; SWR sigue siendo la fuente de verdad. El eco optimista del Change A
  reconcilia por `wamid`.
- **Fuga de canal entre orgs** si la validación del subscription token es laxa.
  **Mitigación**: namespace sin `allow_subscribe_for_client` + verificación de
  membresía y de pertenencia de la conversación a la org antes de emitir.
- **HMAC desalineado** entre app y Centrífugo → todas las conexiones fallan.
  **Mitigación**: `CENTRIFUGO_TOKEN_HMAC_SECRET` debe ser idéntico a
  `client.token.hmac_secret_key`; documentar en el README de despliegue.
- **Publish best-effort puede perder un evento** si Centrífugo está caído.
  **Mitigación**: el fallback de polling (30–60s) y la revalidación en reconexión
  cubren el hueco; no se pierde durabilidad (la BD ya tiene el dato).
- **Coste de conexiones WS** con muchas pestañas. **Mitigación**: una instancia por
  pestaña, suscripciones acotadas al número/conversación activos; aceptable para la
  escala actual.

## Migration Plan

1. Configurar el namespace `inbox` y el `http_api.key`/`hmac_secret_key` en el
   Centrífugo desplegado (infra, fuera del repo).
2. Añadir las 4 variables de entorno (opcionales) y las dependencias.
3. Desplegar backend (puerto + adaptador + endpoints de token + publish en webhook)
   y frontend (suscripción + baja de polling) juntos.
4. Rollback: como las env vars son opcionales y el cliente degrada a polling, basta
   con quitar `NEXT_PUBLIC_CENTRIFUGO_WS_URL` (o revertir el commit) para volver al
   comportamiento por polling. Sin estado persistente que limpiar.

## Open Questions

- **Eco inmediato desde las rutas de envío**: ¿publicamos también en el endpoint de
  envío (para que otros agentes vean el saliente al instante, sin esperar el webhook
  `message.sent`) o confiamos solo en el webhook? Propuesta: publicar también en la
  ruta de envío (barato y mejora la sensación colaborativa); queda como tarea
  marcada opcional.
- **Cadencia exacta del fallback** (30s vs 60s): decidir en `apply` según se sienta
  en pruebas; el spec admite el rango.

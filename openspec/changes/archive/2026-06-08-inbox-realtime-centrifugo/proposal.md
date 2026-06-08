## Why

Hoy la bandeja del inbox se mantiene "viva" con polling de SWR cada 4 segundos
para conversaciones e hilo. Funciona, pero introduce latencia perceptible (hasta
4s para ver un entrante o un cambio de estado), genera carga constante contra la
API/Kapso aunque no pase nada, y no escala bien con muchos agentes/pestañas
abiertas. En el change anterior el realtime se marcó como Non-Goal a propósito;
ahora lo abordamos con Centrífugo v6.8.1 (ya desplegado por el equipo), que encaja
con un Next serverless: el navegador se conecta directo al WebSocket de Centrífugo
y nuestro backend solo *publica* por HTTP API tras procesar los webhooks.

## What Changes

- **Puerto de realtime en la capa de servicios**: se introduce un puerto
  `RealtimePublisher` (interfaz pura) que recibe el `ctx`/deps; la capa
  `lib/services/` permanece sin I/O propio. Un adaptador de Centrífugo en
  `lib/integrations/centrifugo/` implementa el puerto contra la HTTP API v6
  (`POST {API_URL}/api/publish` con header `X-API-Key`).
- **Publicación de eventos tras ingesta**: el webhook de Kapso publica a Centrífugo
  **después** de confirmar el commit en BD (tras `ingestInboundMessage` e
  `ingestDeliveryStatus`). Las rutas de envío pueden publicar también para eco
  inmediato entre agentes de la misma organización.
- **Canales multi-tenant**: namespace `notify_inbox` con `notify_inbox:org.<orgId>` (eventos de
  lista: nueva conversación, reorden, no leídos, estado de ventana) e
  `notify_inbox:conv.<conversationId>` (eventos del hilo: mensaje nuevo, estado de
  entrega). Se evita el carácter `#` (en Centrífugo delimita canales por user-id).
- **Seguridad por tokens**: el namespace `notify_inbox` NO habilita
  `allow_subscribe_for_client`, de modo que toda suscripción exige un
  **subscription token** JWT. Nuestra API emite el token de conexión (`sub=userId`)
  y los tokens de suscripción por canal **solo tras verificar la membresía** de la
  organización (reutiliza `requireOrgMembership`). Un agente de la org A no puede
  suscribirse a canales de la org B.
- **Cliente realtime**: `centrifuge-js` conecta al WS de Centrífugo y se suscribe a
  los canales del número/conversación activos; cada publicación dispara `mutate()`
  de SWR (realtime como señal, SWR como fuente de verdad reconciliable).
- **Polling como respaldo**: el `refreshInterval` de SWR baja de 4s a un fallback
  lento (30–60s), complementado con revalidación al recuperar foco y al reconectar
  el WebSocket.
- **Nuevas variables de entorno**: `CENTRIFUGO_API_URL`, `CENTRIFUGO_API_KEY`,
  `CENTRIFUGO_TOKEN_HMAC_SECRET` (secretas) y `NEXT_PUBLIC_CENTRIFUGO_WS_URL`
  (pública, va al navegador).

## Capabilities

### New Capabilities
- `inbox-realtime`: transporte en tiempo real del inbox — puerto/adaptador de
  publicación, modelo de canales multi-tenant, emisión de tokens de conexión y
  suscripción con autorización por organización, suscripción del cliente y
  reemplazo del polling agresivo por push + fallback.

### Modified Capabilities
- `inbox`: el procesamiento de webhooks publica un evento de realtime tras
  confirmar el commit; la actualización de la UI deja de depender del polling
  agresivo (pasa a near-real-time vía push con polling de respaldo).

## Impact

- **Código (servicios/puertos)**: nuevo puerto en `web/lib/services/inbox/`
  (o `web/lib/services/realtime/`), tipos del `ServiceContext`/deps para inyectar
  `realtime`.
- **Código (integración)**: nuevo `web/lib/integrations/centrifugo/` (adaptador
  HTTP API + firmado de JWT de conexión/suscripción).
- **Código (webhook/rutas)**: `web/app/api/webhooks/kapso/route.ts` publica tras
  ingesta; nuevas rutas REST para token de conexión y token de suscripción
  (tenant-scoped) bajo `web/lib/api/routes/v1/`.
- **Código (cliente)**: `web/components/app/inbox-client.tsx` (suscripción
  `centrifuge-js`, disparo de `mutate`, baja del `refreshInterval`).
- **Dependencias nuevas**: `centrifuge` (cliente JS) y una librería de JWT
  (p. ej. `jose`) si no existe ya en el proyecto.
- **Configuración/infra**: 4 variables de entorno nuevas; el HMAC debe coincidir
  con `client.token.hmac_secret_key` del Centrífugo desplegado. Sin migraciones de
  BD.
- **Depende de** `inbox-chrome-and-optimistic-send` (Change A) para el estado base
  del cliente del inbox.

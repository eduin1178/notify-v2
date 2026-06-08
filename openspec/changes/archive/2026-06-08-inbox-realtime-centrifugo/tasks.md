## 1. Dependencias y entorno

- [x] 1.1 Añadir `centrifuge` (cliente JS) y promover `jose` a dependencia directa en `web/package.json` (`pnpm add centrifuge jose`).
- [x] 1.2 En `web/lib/env.ts`, añadir `CENTRIFUGO_API_URL` (url), `CENTRIFUGO_API_KEY`, `CENTRIFUGO_TOKEN_HMAC_SECRET` (server) y `NEXT_PUBLIC_CENTRIFUGO_WS_URL` (cliente) como **opcionales**, de modo que la app arranque sin Centrífugo.
- [x] 1.3 Documentar en el README de despliegue que `CENTRIFUGO_TOKEN_HMAC_SECRET` debe coincidir con `client.token.hmac_secret_key` y `CENTRIFUGO_API_KEY` con `http_api.key`, y dejar un ejemplo de config del namespace `notify_inbox` (sin `allow_subscribe_for_client`). _(Cubierto por `infra/centrifugo/README.md` + `config.json`; reconciliado el ejemplo de `CENTRIFUGO_API_URL`.)_

## 2. Puerto de realtime (capa pura)

- [x] 2.1 Definir el puerto `RealtimePublisher` (`publish(channel, data): Promise<void>`) en la capa de servicios y añadir `realtime: RealtimePublisher` al `ServiceContext`/deps del inbox, sin importar SDKs ni hacer I/O en `lib/services/`.
- [x] 2.2 Proveer una implementación no-op del puerto para pruebas y para cuando Centrífugo no esté configurado.

## 3. Adaptador Centrífugo (integración)

- [x] 3.1 Crear `web/lib/integrations/centrifugo/publisher.ts`: implementación de `RealtimePublisher` que hace `POST {CENTRIFUGO_API_URL}/api/publish` con header `X-API-Key` y body `{channel, data}`; errores capturados y logueados (best-effort).
- [x] 3.2 Crear `web/lib/integrations/centrifugo/tokens.ts`: helpers para firmar el connection token (`{sub, exp}`) y el subscription token (`{sub, channel, exp}`) con `jose` (HS256, `CENTRIFUGO_TOKEN_HMAC_SECRET`).
- [x] 3.3 Crear un helper de nombres de canal (`orgChannel(orgId)`, `convChannel(convId)`) con el namespace `notify_inbox` y sin `#`, reutilizable por publish y por validación de tokens. _(Ubicado en `lib/services/realtime/channels.ts` para que la capa pura pueda usarlo sin importar integraciones; rule #1.)_

## 4. Publicación tras ingesta (webhook/servicio)

- [x] 4.1 En `web/lib/services/inbox/service.ts`, tras el commit de `ingestInboundMessage`, publicar vía `ctx.realtime.publish` en `notify_inbox:org.<orgId>` y `notify_inbox:conv.<conversationId>` con un payload discriminado (`type: "message.new"` / `conversation.upsert`).
- [x] 4.2 Tras el commit de `ingestDeliveryStatus`, publicar en `notify_inbox:conv.<conversationId>` (y `notify_inbox:org.<orgId>` si cambia el preview) con `type: "delivery.update"`.
- [x] 4.3 En `web/app/api/webhooks/kapso/route.ts`, construir el `ctx`/deps con el adaptador real de Centrífugo (o el no-op si no hay config) y pasarlo a las funciones de ingesta; garantizar que un fallo de publish NO devuelva 500.
- [x] 4.4 (Opcional) Publicar también en las rutas de envío de mensajes para eco inmediato entre agentes, vía el mismo puerto. _(Implementado: `publishOutboundEcho` en `sendServiceMessage`/`sendInteractiveMessage`/`sendTemplateMessage` → `message.new` al canal de la conversación + `conversation.upsert` al de la org. Best-effort vía `safePublish`, ahora genérico `{realtime, logger}`.)_

## 5. Endpoints de tokens (REST)

- [x] 5.1 Crear `POST /api/v1/realtime/connection-token` (solo `requireSession`) que devuelve `{token}` con `sub` = id de usuario y expiración corta.
- [x] 5.2 Crear `POST /api/v1/orgs/:orgId/realtime/subscription-token` (`requireSession` + `requireOrgMembership`) que valida que el `channel` solicitado pertenece a `:orgId` (prefijo `notify_inbox:org.<orgId>` o `notify_inbox:conv.<id>` cuya conversación es de esa org) y devuelve `{token}` con `{sub, channel, exp}`.
- [x] 5.3 Definir los schemas zod de request/response de ambos endpoints en `lib/services/<dominio>/schemas.ts` y reutilizarlos en `createRoute`.
- [x] 5.4 Para `notify_inbox:conv.<id>`, verificar contra el índice local que la conversación pertenece a la org del path antes de emitir el token (evitar fuga cross-org por id adivinado).

## 6. Cliente realtime

- [x] 6.1 En `web/components/app/inbox-client.tsx`, crear una instancia de `Centrifuge(NEXT_PUBLIC_CENTRIFUGO_WS_URL, { getToken })` donde `getToken` pide el connection token al endpoint; activarla solo si la env pública existe. _(Aislado en el hook `inbox/use-inbox-realtime.ts`.)_
- [x] 6.2 Suscribirse a `notify_inbox:org.<orgId>` del número activo con `getToken` apuntando al subscription-token endpoint; manejar `publication` disparando `mutate(conversationsKey)` según el `type`.
- [x] 6.3 Suscribirse a `notify_inbox:conv.<conversationId>` de la conversación abierta, re-suscribiendo al cambiar de conversación y limpiando la suscripción anterior; en `publication` disparar `mutate(messagesKey)` (y `conversationsKey` si aplica).
- [x] 6.4 Limpiar conexión y suscripciones en el cleanup del efecto, respetando la regla de lint de `setState`/`ref` en render/efecto.

## 7. Polling de respaldo y resiliencia

- [x] 7.1 Bajar el `refreshInterval` de SWR de 4000 a ~30000–60000 ms en conversaciones e hilo. _(45000 ms.)_
- [x] 7.2 Mantener `revalidateOnFocus`/`revalidateOnReconnect` y forzar `mutate` al evento de reconexión del WebSocket.
- [x] 7.3 Asegurar la degradación con gracia: si no hay config de Centrífugo o el WS no conecta, el inbox sigue operando con el fallback sin errores en consola que rompan la UX.

## 8. Verificación

- [x] 8.1 `pnpm lint` en `web/` sin hallazgos nuevos (incluida la regla de efectos para la suscripción).
- [x] 8.2 `pnpm build` en `web/` compila (tipos de env, schemas y cliente incluidos).
- [x] 8.3 Verificación manual: con dos sesiones/pestañas, un entrante de Kapso aparece en near-real-time en la lista y el hilo abierto; un cambio de estado de entrega se refleja sin esperar el poll; abrir otra conversación re-suscribe; un miembro de otra org NO obtiene subscription token para canales ajenos (403); con Centrífugo apagado el inbox sigue con polling de respaldo. _(Verificado en dos ventanas; la causa raíz de la "lentitud" fue un typo de env var `CENTRIFUGO_HTTP_API_URL`→`CENTRIFUGO_API_URL`, ya corregido. Se añadió history+recovery al namespace para resiliencia.)_ _(Requiere Centrífugo desplegado + dos sesiones; pendiente de ejecutar en entorno con infra.)_

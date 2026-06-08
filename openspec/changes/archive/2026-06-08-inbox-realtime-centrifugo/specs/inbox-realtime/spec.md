## ADDED Requirements

### Requirement: Puerto de publicación de realtime desacoplado del transporte

El sistema SHALL exponer un puerto `RealtimePublisher` en la capa de servicios
como interfaz pura, recibido a través del `ctx`/deps, SIN realizar I/O directo ni
importar el SDK de Centrífugo dentro de `lib/services/`. Un adaptador en
`lib/integrations/centrifugo/` SHALL implementar el puerto contra la HTTP API de
Centrífugo v6 (`POST {CENTRIFUGO_API_URL}/api/publish` con el header
`X-API-Key`). En contextos de prueba, el puerto SHALL poder sustituirse por una
implementación no-op.

#### Scenario: Servicio publica sin acoplarse al transporte
- **WHEN** una función de servicio necesita emitir un evento de realtime
- **THEN** invoca `ctx.realtime.publish(channel, data)` del puerto, sin conocer Centrífugo ni hacer I/O en la capa pura

#### Scenario: Adaptador traduce a la HTTP API v6
- **WHEN** el adaptador de Centrífugo recibe una publicación
- **THEN** hace `POST {CENTRIFUGO_API_URL}/api/publish` con el header `X-API-Key` y el cuerpo `{channel, data}`

#### Scenario: Sustitución en pruebas
- **WHEN** una prueba ejecuta un servicio que publica eventos
- **THEN** se inyecta un publicador no-op y el servicio se ejecuta sin contactar Centrífugo

### Requirement: Modelo de canales multi-tenant del inbox

El sistema SHALL usar el namespace `notify_inbox` con dos tipos de canal:
`notify_inbox:org.<orgId>` para eventos de la lista de conversaciones de una organización,
e `notify_inbox:conv.<conversationId>` para eventos del hilo de una conversación. Los
nombres de canal NO SHALL usar el carácter `#` (reservado por Centrífugo para
canales limitados por user-id). El identificador de organización y de conversación
SHALL formar parte del nombre del canal de modo que un evento se entregue solo a
los suscriptores del canal correspondiente.

#### Scenario: Evento de lista por organización
- **WHEN** ocurre un cambio que afecta la lista de conversaciones de una organización (nueva conversación, reorden, no leídos, estado de ventana)
- **THEN** el sistema publica en `notify_inbox:org.<orgId>`

#### Scenario: Evento de hilo por conversación
- **WHEN** ocurre un cambio en una conversación (mensaje nuevo, estado de entrega)
- **THEN** el sistema publica en `notify_inbox:conv.<conversationId>`

### Requirement: Autorización de suscripción por membresía de organización

El namespace `notify_inbox` NO SHALL habilitar `allow_subscribe_for_client`, de modo que
toda suscripción exija un subscription token. El sistema SHALL emitir un token de
conexión JWT (con `sub` = id del usuario autenticado) y tokens de suscripción JWT
por canal (con claims `sub`, `channel` y `exp`), ambos firmados con
`CENTRIFUGO_TOKEN_HMAC_SECRET`. El sistema SHALL emitir un token de suscripción a
un canal de una organización ÚNICAMENTE si el usuario autenticado es miembro de esa
organización (reutilizando la verificación de membresía existente).

#### Scenario: Token de conexión para usuario autenticado
- **WHEN** un usuario con sesión válida solicita un token de conexión
- **THEN** el sistema devuelve un JWT firmado con `sub` igual al id del usuario y una expiración

#### Scenario: Suscripción autorizada a su organización
- **WHEN** un usuario miembro de la organización X solicita un token de suscripción para `notify_inbox:org.X` o un `notify_inbox:conv.<id>` de esa organización
- **THEN** el sistema devuelve un subscription token JWT válido para ese canal

#### Scenario: Suscripción denegada a otra organización
- **WHEN** un usuario que NO es miembro de la organización Y solicita un token de suscripción para un canal de la organización Y
- **THEN** el sistema rechaza la solicitud con un error de autorización y no emite token

#### Scenario: Solicitud sin sesión
- **WHEN** un cliente sin sesión válida solicita un token de conexión o de suscripción
- **THEN** el sistema responde no autorizado y no emite token

### Requirement: Suscripción del cliente y actualización en tiempo real

El cliente del inbox SHALL conectarse al WebSocket de Centrífugo
(`NEXT_PUBLIC_CENTRIFUGO_WS_URL`) usando el token de conexión, y SHALL suscribirse
a `notify_inbox:org.<orgId>` del número activo y a `notify_inbox:conv.<conversationId>` de la
conversación abierta, obteniendo los subscription tokens desde la API. Al recibir
una publicación, el cliente SHALL revalidar los datos correspondientes (disparar
`mutate` de SWR) en lugar de esperar al siguiente poll.

#### Scenario: Entrante reflejado sin esperar al poll
- **WHEN** llega un mensaje entrante a una conversación de la organización suscrita
- **THEN** el cliente recibe la publicación y revalida la lista y, si la conversación está abierta, el hilo, mostrando el cambio en near-real-time

#### Scenario: Cambio de estado de entrega reflejado
- **WHEN** cambia el estado de entrega de un saliente (sent/delivered/read/failed)
- **THEN** el cliente recibe la publicación del canal del hilo y actualiza el estado mostrado

#### Scenario: Cambio de conversación re-suscribe
- **WHEN** el agente abre otra conversación
- **THEN** el cliente cancela la suscripción al hilo anterior y se suscribe al canal del nuevo hilo

### Requirement: Polling de respaldo y resiliencia

Con realtime activo, el cliente SHALL reducir el `refreshInterval` de SWR a un
fallback lento (entre 30 y 60 segundos) en lugar del polling agresivo previo, y
SHALL revalidar al recuperar el foco de la ventana y al reconectarse el WebSocket,
de modo que ninguna pérdida temporal de conexión deje datos desactualizados de
forma indefinida.

#### Scenario: Reconexión revalida
- **WHEN** el WebSocket se reconecta tras una caída temporal
- **THEN** el cliente revalida los datos para recuperar lo ocurrido durante la desconexión

#### Scenario: Fallback ante realtime no disponible
- **WHEN** el WebSocket no logra conectarse o no hay configuración de Centrífugo
- **THEN** el inbox sigue funcionando con el polling de respaldo, sin romperse

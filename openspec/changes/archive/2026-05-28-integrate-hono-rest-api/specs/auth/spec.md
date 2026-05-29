## ADDED Requirements

### Requirement: Autenticación en rutas REST

El sistema SHALL aplicar la sesión de `better-auth` a las rutas REST bajo `/api/v1/`. El middleware de autenticación MUST resolver la sesión llamando a `auth.api.getSession({ headers })` pasándole los headers crudos de la request entrante, y MUST aceptar transparentemente cualquier mecanismo soportado por better-auth (hoy: cookie HttpOnly firmada; en el futuro: bearer token a través del plugin que se active para Expo).

#### Scenario: Cookie válida en request REST
- **WHEN** un cliente con cookie de sesión válida envía una request a una ruta `/api/v1/...` protegida
- **THEN** el middleware MUST inyectar `session` y `user` en el contexto Hono y el handler MUST ejecutarse

#### Scenario: Sin credenciales en ruta protegida
- **WHEN** un cliente sin cookie ni Authorization válido envía una request a una ruta `/api/v1/...` protegida
- **THEN** la respuesta MUST ser 401 con cuerpo `{ "error": { "code": "unauthorized", "message": <string> } }`

#### Scenario: Cookie expirada o inválida
- **WHEN** un cliente envía una cookie de sesión expirada o con firma inválida
- **THEN** `auth.api.getSession` MUST devolver sesión nula y el middleware MUST responder 401 con `code: "unauthorized"`

### Requirement: Autorización por membresía de organización en path

Las rutas REST de la forma `/api/v1/orgs/:orgId/...` MUST aplicar un middleware que verifique que el usuario autenticado es miembro de la organización identificada por `:orgId`. La membresía MUST consultarse en la tabla `member` del esquema de `better-auth`. El sistema MUST NO usar la "organización activa" en sesión como sustituto del path: la organización del path es la fuente única de verdad.

#### Scenario: Miembro accede a su organización
- **WHEN** un usuario autenticado miembro de la organización `X` envía una request a `/api/v1/orgs/X/...`
- **THEN** el middleware MUST inyectar la organización resuelta en el contexto y el handler MUST ejecutarse

#### Scenario: Usuario autenticado pero no miembro
- **WHEN** un usuario autenticado NO miembro de la organización `Y` envía una request a `/api/v1/orgs/Y/...`
- **THEN** la respuesta MUST ser 403 con `error.code: "forbidden"`

#### Scenario: Organización inexistente
- **WHEN** un usuario autenticado envía una request a `/api/v1/orgs/<id-inexistente>/...`
- **THEN** la respuesta MUST ser 404 con `error.code: "not_found"`

#### Scenario: Organización activa en cookie no influye en REST
- **WHEN** un usuario miembro de `A` y `B` con organización activa `B` en cookie envía `GET /api/v1/orgs/A/...`
- **THEN** el middleware MUST resolver y autorizar contra `A` (ignorando la organización activa de la sesión)

## ADDED Requirements

### Requirement: REST API montada bajo `/api/` con Hono dentro de Next

El sistema SHALL exponer una REST API servida por Hono, montada dentro del proyecto Next mediante un único route handler catch-all en `web/app/api/[[...route]]/route.ts`. La API MUST coexistir con el handler existente de `better-auth` en `web/app/api/auth/[...all]/route.ts`, que MUST seguir siendo atendido por better-auth sin modificación.

#### Scenario: Las rutas REST responden bajo /api/
- **WHEN** un cliente HTTP envía `GET /api/v1/me` con sesión válida
- **THEN** la respuesta proviene de la app Hono y devuelve un JSON con el usuario

#### Scenario: Las rutas de better-auth no se ven afectadas
- **WHEN** un cliente HTTP envía cualquier request a `/api/auth/...`
- **THEN** la response proviene del handler de better-auth, no de Hono

#### Scenario: Rutas desconocidas devuelven 404 JSON
- **WHEN** un cliente HTTP envía una request a una ruta no definida bajo `/api/v1/`
- **THEN** la respuesta MUST ser status 404 con cuerpo `{ "error": { "code": "not_found", "message": <string> } }`

### Requirement: Versionado obligatorio bajo `/v1/`

Todos los endpoints REST de dominio MUST montarse bajo el prefijo `/api/v1/`. No SHALL existir ningún endpoint REST de dominio fuera de un prefijo versionado. El handler de better-auth (`/api/auth/...`) está exento de esta regla por ser un contrato externo de librería.

#### Scenario: Endpoint sin versión no existe
- **WHEN** un cliente envía `GET /api/me` (sin `/v1/`)
- **THEN** la respuesta MUST ser 404 con el formato de error estándar

#### Scenario: Documentación referencia versión
- **WHEN** un consumidor solicita `/api/v1/openapi.json`
- **THEN** el documento OpenAPI MUST declarar `servers[0].url` terminado en `/api/v1` y MUST listar todas las rutas relativas a ese servidor

### Requirement: Contrato declarado con `@hono/zod-openapi`

Cada endpoint REST MUST definirse con `createRoute` de `@hono/zod-openapi` incluyendo `method`, `path`, `tags`, `request` (schemas zod para params/query/body) y `responses` (schemas zod por status code). El sistema MUST validar input automáticamente a partir de esos schemas y MUST rechazar con 400 cualquier request cuyo input no cumpla.

#### Scenario: Input inválido se rechaza con 400
- **WHEN** un cliente envía un body que no cumple el schema declarado
- **THEN** la respuesta MUST ser 400 con cuerpo `{ "error": { "code": "validation_error", "issues": <array> } }`

#### Scenario: Path param inválido se rechaza con 400
- **WHEN** un cliente envía un `:orgId` que no cumple su schema
- **THEN** la respuesta MUST ser 400 con `code: "validation_error"` antes de ejecutar el handler

### Requirement: OpenAPI 3.x publicado en `/api/v1/openapi.json`

El sistema SHALL servir la especificación OpenAPI 3.x generada automáticamente desde los schemas zod en `GET /api/v1/openapi.json`. La spec MUST estar disponible tanto en desarrollo como en producción.

#### Scenario: La spec está disponible en producción
- **WHEN** un consumidor envía `GET /api/v1/openapi.json` en un entorno productivo
- **THEN** la respuesta MUST ser 200 con `Content-Type: application/json` y el documento OpenAPI completo

#### Scenario: La spec incluye todas las rutas registradas
- **WHEN** se añade un nuevo endpoint a la app Hono
- **THEN** el documento OpenAPI servido MUST listarlo sin paso de codegen manual

### Requirement: Documentación interactiva sólo en desarrollo

El sistema SHALL servir una UI interactiva de documentación (Scalar) en `GET /api/v1/docs` cuando `NODE_ENV !== "production"`. En producción, esa ruta MUST devolver 404.

#### Scenario: UI disponible en desarrollo
- **WHEN** un desarrollador navega a `/api/v1/docs` con `NODE_ENV=development`
- **THEN** la respuesta MUST ser una página HTML con la referencia interactiva apuntando a `/api/v1/openapi.json`

#### Scenario: UI bloqueada en producción
- **WHEN** un cliente navega a `/api/v1/docs` con `NODE_ENV=production`
- **THEN** la respuesta MUST ser 404 con el formato de error estándar

### Requirement: Cliente RPC tipado vía `AppType`

El módulo de la API MUST exportar `export type AppType = typeof app` desde `web/lib/api/app.ts`, donde `app` es la instancia raíz de Hono ya con todas las rutas montadas. Los clientes TypeScript (web y Expo) SHALL poder consumir la API con `hc<AppType>(baseUrl)` y obtener tipos end-to-end sin codegen.

#### Scenario: Web consume la API con tipos
- **WHEN** un Server Component o cliente de la web importa el helper `apiClient` construido sobre `hc<AppType>()`
- **THEN** los nombres de ruta, params, body y respuesta MUST estar tipados estáticamente
- **AND** una llamada con shape incorrecta MUST fallar en compilación de TypeScript

### Requirement: Manejo de errores uniforme

El sistema SHALL convertir todos los errores no manejados en respuestas JSON con la forma `{ "error": { "code": <string>, "message": <string>, "issues"?: <array> } }`. Los códigos canónicos iniciales MUST ser:

- `unauthorized` → 401
- `forbidden` → 403
- `not_found` → 404
- `conflict` → 409
- `validation_error` → 400
- `rate_limited` → 429 (reservado, no implementado en este change)
- `internal_error` → 500

El error handler MUST mapear `DomainError` (definido en la capa de servicios) a su `status` y `code` declarados, `ZodError` a `validation_error`, y cualquier otro error inesperado a `internal_error` registrando el error original en el logger del servidor.

#### Scenario: DomainError de "not found" se traduce a 404
- **WHEN** un servicio lanza `DomainError` con `code: "not_found"` y `status: 404`
- **THEN** la respuesta HTTP MUST tener status 404 y cuerpo `{ "error": { "code": "not_found", "message": <string> } }`

#### Scenario: Error inesperado se enmascara como 500
- **WHEN** un handler lanza una excepción no controlada (no `DomainError`, no `ZodError`)
- **THEN** la respuesta HTTP MUST tener status 500 con cuerpo `{ "error": { "code": "internal_error", "message": <string genérico> } }`
- **AND** el error original MUST registrarse en el logger del servidor (no exponerse al cliente)

#### Scenario: ZodError de validación devuelve issues
- **WHEN** la validación de input zod falla
- **THEN** la respuesta MUST ser 400 con `error.code: "validation_error"` y `error.issues` reflejando los problemas detectados

### Requirement: Multi-tenancy expresada en el path

Las rutas que operen sobre recursos de una organización MUST tener forma `/api/v1/orgs/:orgId/...`. El handler NO MUST inferir la organización de la sesión ni de cookies; la organización del path es la fuente única de verdad para REST.

#### Scenario: orgId en path se usa para todas las operaciones de ese recurso
- **WHEN** un usuario miembro de las organizaciones `A` y `B` envía `GET /api/v1/orgs/A/members` mientras su "organización activa" en cookie es `B`
- **THEN** la respuesta MUST listar miembros de `A`, no de `B`

### Requirement: Endpoints piloto del cambio

Como parte de este change, el sistema MUST exponer al menos estos endpoints, funcionales y autodocumentados:

- `GET /api/v1/me` — devuelve `{ user, organizations }` del usuario autenticado.
- `GET /api/v1/orgs/:orgId` — devuelve datos de la organización si el usuario es miembro.
- `GET /api/v1/orgs/:orgId/members` — lista miembros si el usuario es miembro.

Cada uno MUST tener su schema zod de respuesta, MUST validar autenticación y (cuando corresponda) membresía, y MUST aparecer en la spec OpenAPI.

#### Scenario: GET /v1/me sin sesión
- **WHEN** un cliente envía `GET /api/v1/me` sin sesión válida
- **THEN** la respuesta MUST ser 401 con `error.code: "unauthorized"`

#### Scenario: GET /v1/me con sesión
- **WHEN** un usuario autenticado envía `GET /api/v1/me`
- **THEN** la respuesta MUST ser 200 con `{ user: {...}, organizations: [...] }` validado por el schema declarado

#### Scenario: GET /v1/orgs/:orgId con usuario no miembro
- **WHEN** un usuario autenticado envía `GET /api/v1/orgs/:orgId` y NO es miembro de esa organización
- **THEN** la respuesta MUST ser 403 con `error.code: "forbidden"`

#### Scenario: GET /v1/orgs/:orgId con miembro
- **WHEN** un usuario miembro envía `GET /api/v1/orgs/:orgId`
- **THEN** la respuesta MUST ser 200 con los datos de la organización validados por el schema

#### Scenario: GET /v1/orgs/:orgId/members con miembro
- **WHEN** un usuario miembro envía `GET /api/v1/orgs/:orgId/members`
- **THEN** la respuesta MUST ser 200 con la lista de miembros validada por el schema

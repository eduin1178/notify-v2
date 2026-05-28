## ADDED Requirements

### Requirement: Capa de servicios independiente del transporte

El sistema SHALL exponer la lógica de dominio como servicios puros bajo `web/lib/services/<dominio>/`. Cada servicio MUST NO importar nada de `next/*`, `hono`, `@hono/*`, ni de las carpetas `web/app/**`. Esta independencia MUST permitir que el mismo servicio se invoque desde Server Actions, rutas Hono y procesos sin HTTP (jobs, CLIs).

#### Scenario: Un servicio no depende de Next
- **WHEN** se inspeccionan los imports de cualquier archivo bajo `web/lib/services/`
- **THEN** NO MUST haber imports de `next/*`, `hono`, `@hono/*`, ni `web/app/**`

#### Scenario: Mismo servicio invocado desde dos transportes
- **WHEN** un endpoint Hono y una Server Action implementan la misma operación de dominio
- **THEN** ambos MUST delegar en la misma función exportada por `web/lib/services/<dominio>/service.ts`

### Requirement: Contexto explícito por llamada

Cada función pública de servicio MUST recibir como primer argumento un objeto `ctx` con al menos `{ db, currentUser, currentOrg?, logger }`. El servicio MUST NO leer la sesión, la base de datos, ni el usuario actual desde imports globales o singletons. `currentOrg` SHALL ser obligatorio sólo en servicios tenant-scoped.

#### Scenario: Servicio recibe ctx explícito
- **WHEN** un servicio realiza una operación que requiere identidad del usuario
- **THEN** la función MUST recibir `currentUser` vía `ctx`, NO obtenerlo de un singleton ni de `headers()` de Next

#### Scenario: Servicio tenant-scoped exige currentOrg
- **WHEN** una función de servicio opera sobre datos de una organización
- **THEN** su firma MUST exigir `currentOrg` en `ctx` y MUST fallar en compilación si se omite

### Requirement: Errores de dominio tipados

El sistema SHALL definir una clase `DomainError` en `web/lib/services/errors.ts` con campos `code: string` y `status: number`. Los servicios MUST lanzar `DomainError` para situaciones de dominio (no encontrado, conflicto, prohibido, etc.) y MUST NO devolver tuplas `[error, data]` ni códigos de error en strings. Errores inesperados (programación) MUST lanzarse como `Error` estándar y NO MUST mezclarse con `DomainError`.

#### Scenario: Recurso inexistente
- **WHEN** un servicio busca un recurso que no existe
- **THEN** MUST lanzar `new DomainError({ code: "not_found", status: 404, message: <string> })`

#### Scenario: Acceso prohibido
- **WHEN** un servicio detecta que el usuario actual no puede ejecutar la operación sobre el recurso
- **THEN** MUST lanzar `DomainError` con `code: "forbidden"` y `status: 403`

#### Scenario: Conflicto de unicidad
- **WHEN** un servicio intenta crear un recurso que viola una restricción de unicidad
- **THEN** MUST lanzar `DomainError` con `code: "conflict"` y `status: 409`

### Requirement: Server Actions y rutas Hono actúan como adaptadores delgados

Las Server Actions y las rutas Hono MUST limitarse a: (1) construir `ctx`, (2) invocar el servicio, (3) traducir resultado/error al transporte (Next: `revalidatePath`/`redirect`/retorno; Hono: `c.json(...)`). NO MUST contener lógica de dominio, queries de Drizzle directas, ni reglas de autorización propias del recurso.

#### Scenario: Server Action que migra a usar servicio
- **WHEN** se migra una Server Action existente a la nueva capa
- **THEN** MUST eliminar de su cuerpo las queries de Drizzle y la validación de permisos del dominio
- **AND** MUST delegar esas responsabilidades al servicio correspondiente

#### Scenario: Ruta Hono sin lógica de dominio
- **WHEN** se inspecciona un handler Hono de un endpoint REST
- **THEN** NO MUST contener queries de Drizzle directas ni reglas de autorización de dominio
- **AND** MUST llamar a un servicio bajo `web/lib/services/`

### Requirement: Servicios piloto entregados con este change

El change MUST entregar al menos los siguientes servicios funcionando, cubiertos por los endpoints REST piloto:

- `web/lib/services/me/` con función `getMe(ctx)` → `{ user, organizations }`.
- `web/lib/services/orgs/` con `getOrg(ctx, orgId)` y `listMembers(ctx, orgId)`.

Cada servicio MUST exportar sus schemas zod de entrada/salida desde `schemas.ts` para que el adaptador REST los reutilice en `createRoute`.

#### Scenario: getOrg se reutiliza desde REST y Server Action
- **WHEN** el endpoint `GET /api/v1/orgs/:orgId` se ejecuta
- **THEN** internamente MUST llamar a `getOrg(ctx, orgId)` exportado por `web/lib/services/orgs/service.ts`

#### Scenario: Schemas se comparten entre servicio y ruta
- **WHEN** la ruta `GET /api/v1/orgs/:orgId` declara su `responses.200` en `createRoute`
- **THEN** MUST reutilizar el schema exportado por `web/lib/services/orgs/schemas.ts` (no redefinirlo)

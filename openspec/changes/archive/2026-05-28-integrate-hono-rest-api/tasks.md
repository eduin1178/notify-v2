## 1. Setup de dependencias

- [x] 1.1 Añadir `hono`, `@hono/zod-openapi` y `@scalar/hono-api-reference` a `web/package.json` (`pnpm add`)
- [x] 1.2 Verificar que `zod` ya esté en versión compatible con `@hono/zod-openapi` y registrar la versión en `design.md` si hubiera incompatibilidad
- [x] 1.3 Confirmar que `next.config.ts` no fuerza `runtime = "edge"` globalmente para `/api/*`

## 2. Capa de servicios — andamiaje

- [x] 2.1 Crear `web/lib/services/errors.ts` con la clase `DomainError` (`code`, `status`, `message`) y un helper `isDomainError`
- [x] 2.2 Crear `web/lib/services/context.ts` con el tipo `ServiceContext` (`{ db, currentUser, currentOrg?, logger }`) y `TenantServiceContext` (con `currentOrg` requerido)
- [x] 2.3 Crear `web/lib/services/logger.ts` (envoltura mínima sobre `console` con niveles; reemplazable en el futuro)
- [x] 2.4 Documentar en JSDoc en `errors.ts` y `context.ts` la regla "no imports de `next/*`, `hono`, `@hono/*` ni `web/app/**`"

## 3. Servicios piloto

- [x] 3.1 Crear `web/lib/services/me/schemas.ts` (zod): `UserDto`, `OrganizationSummaryDto`, `MeResponse`
- [x] 3.2 Crear `web/lib/services/me/service.ts` exportando `getMe(ctx: ServiceContext): Promise<MeResponse>` (consulta `member` + `organization` para el `currentUser`)
- [x] 3.3 Crear `web/lib/services/orgs/schemas.ts`: `OrganizationDto`, `MemberDto`, `OrgIdParam`
- [x] 3.4 Crear `web/lib/services/orgs/service.ts` con `getOrg(ctx, orgId)` y `listMembers(ctx, orgId)`; ambos lanzan `DomainError` `not_found`/`forbidden` según corresponda

## 4. Módulo de API — núcleo

- [x] 4.1 Crear `web/lib/api/context.ts` con el tipo `HonoEnv` (`Variables: { session, user, org? }`)
- [x] 4.2 Crear `web/lib/api/errors.ts` con el error handler global (`onError`) que mapea `DomainError`, `ZodError` y `Error` al contrato de error JSON definido en el spec
- [x] 4.3 Crear `web/lib/api/middlewares/auth.ts` con `requireSession` que invoca `auth.api.getSession({ headers: c.req.raw.headers })` y rellena `c.set("session", ...)` / `c.set("user", ...)`
- [x] 4.4 Crear `web/lib/api/middlewares/org.ts` con `requireOrgMembership` que lee `c.req.param("orgId")`, consulta `member`/`organization`, lanza `DomainError` apropiado y rellena `c.set("org", ...)`
- [x] 4.5 Crear `web/lib/api/build-ctx.ts` con `buildServiceContext(c)` que construye `ServiceContext`/`TenantServiceContext` desde las variables del contexto Hono

## 5. Módulo de API — rutas piloto

- [x] 5.1 Crear `web/lib/api/routes/v1/me.ts` con `createRoute` para `GET /me`, schemas reutilizando `services/me/schemas`, middleware `requireSession`, handler que llama `getMe`
- [x] 5.2 Crear `web/lib/api/routes/v1/orgs/get-org.ts` con `createRoute` para `GET /orgs/:orgId`, middlewares `requireSession` + `requireOrgMembership`, handler que llama `getOrg`
- [x] 5.3 Crear `web/lib/api/routes/v1/orgs/list-members.ts` con `createRoute` para `GET /orgs/:orgId/members`, mismos middlewares, handler que llama `listMembers`
- [x] 5.4 Crear `web/lib/api/routes/v1/index.ts` que combina los sub-routers anteriores

## 6. App raíz y montaje en Next

- [x] 6.1 Crear `web/lib/api/app.ts` con `const app = new OpenAPIHono<HonoEnv>().basePath("/api")`, registrar `onError`, montar `/v1`, registrar `doc` en `/v1/openapi.json` y `Scalar` en `/v1/docs` condicionado por `NODE_ENV !== "production"`
- [x] 6.2 Exportar `export type AppType = typeof app` desde `web/lib/api/app.ts`
- [x] 6.3 Crear `web/lib/api/client.ts` con `createApiClient(baseUrl)` que devuelve `hc<AppType>(baseUrl)`
- [x] 6.4 Crear `web/app/api/[[...route]]/route.ts` que reexporta `GET, POST, PUT, PATCH, DELETE, OPTIONS` desde `handle(app)` (usando `hono/vercel` o `handle` equivalente para Next 16)
- [x] 6.5 Verificar que el route handler corre en Node runtime por defecto (no forzar Edge); documentar en comentario corto si se requiere `export const runtime = "nodejs"`

## 7. Verificación de coexistencia con better-auth

- [x] 7.1 Levantar `pnpm dev` y enviar `GET /api/auth/get-session` con curl; debe responder igual que antes (better-auth lo atiende, no Hono)
- [x] 7.2 Iniciar sesión vía UI y enviar `GET /api/v1/me` con la cookie resultante; debe devolver 200 con JSON `{ user, organizations }`
- [x] 7.3 Sin cookie enviar `GET /api/v1/me`; debe devolver 401 con el contrato de error
- [x] 7.4 Confirmar que `/api/v1/openapi.json` y `/api/v1/docs` responden en dev; que `/api/v1/docs` devuelve 404 si se setea `NODE_ENV=production` localmente

## 8. Migración mínima de Server Actions piloto

- [x] 8.1 Identificar lecturas que ya hagan "obtener mi info" o "leer organización por id"/"listar miembros" y reescribirlas para delegar en `getMe`/`getOrg`/`listMembers`. **Nota:** las Server Actions existentes (`members/actions.ts`, `super-admin/users/actions.ts`, etc.) son operaciones de escritura sin contraparte en los servicios piloto. La lectura de miembros vivía en `web/app/(app)/org/[orgSlug]/members/page.tsx` (Server Component, no Server Action); se migró a `listMembers` con el patrón "Server Component como adaptador".
- [x] 8.2 Asegurar que el adaptador (Server Component `members/page.tsx`) sólo: obtiene contexto, construye `ServiceContext` vía `buildServerServiceContext`, llama al servicio. No contiene la query directa de miembros (eliminada).
- [x] 8.3 Smoke test manual: la página `/org/<slug>/members` sigue funcionando idénticamente

## 9. Consumo desde la web (validación de tipos end-to-end)

- [x] 9.1 Crear `web/lib/api/server-client.ts` que construya `hc<AppType>(baseUrl)` para uso desde Server Components reenviando la cookie de sesión vía `headers()`
- [x] 9.2 El consumo desde la web pasa por la capa de servicios directa (sin hop HTTP interno). El cliente RPC tipado queda listo para Expo y para Server Components que prefieran consumir vía REST. Validación end-to-end se hará en smoke test manual.
- [x] 9.3 Confirmar que `pnpm build` compila sin errores de tipos (build limpio ejecutado)

## 10. Documentación interna

- [x] 10.1 Añadir `web/lib/api/README.md` corto explicando: estructura, cómo añadir un endpoint, dónde van los schemas, regla del `ctx`, cómo correr docs locales
- [x] 10.2 Añadir `web/lib/services/README.md` corto explicando la regla "sin Next/Hono" y el patrón `ctx + DomainError`
- [x] 10.3 Actualizar `web/README.md` con una sección "REST API" apuntando a los dos READMEs anteriores
- [x] 10.4 Añadir a `CLAUDE.md` raíz un bloque "REST API + capa de servicios (OBLIGATORIO)" con las 10 reglas que rigen la nueva arquitectura

## 11. Cierre

- [x] 11.1 `pnpm lint` y `pnpm build` limpios en `web/`
- [x] 11.2 Repaso manual contra los escenarios de `specs/rest-api/spec.md`, `specs/service-layer/spec.md` y `specs/auth/spec.md` (este change); marcar discrepancias para iterar antes de archivar
- [x] 11.3 Ejecutar `/opsx:verify` y resolver `CRITICAL`/`WARNING` antes de archivar

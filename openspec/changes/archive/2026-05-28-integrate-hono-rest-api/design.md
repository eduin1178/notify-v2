## Context

El proyecto es una aplicación Next.js 16 (App Router, React 19, TypeScript) desplegada en Vercel. La lógica de negocio vive hoy mezclada con el transporte: Server Actions en `web/app/(app)/...`, helpers en `web/lib/{auth,org,account,db,email}` y el único endpoint REST existente es el handler de `better-auth` en `web/app/api/auth/`.

Multi-tenancy: las organizaciones se modelan con el plugin `organization` de `better-auth` (tablas `organization`, `member`, `invitation`). Un usuario puede pertenecer a varias organizaciones y existe una "organización activa" en sesión (modelo Slack).

Stack y restricciones relevantes:

- Drizzle ORM + Neon serverless (HTTP, no TCP). Apto para Edge y Node.
- `better-auth` 1.3.10 con `nextCookies()` y plugins `organization` + `admin`. Sesión por cookie HttpOnly. `auth.api.getSession({ headers })` es el método canónico para validar.
- Tailwind v4 + shadcn/ui en la web. Esto NO se ve afectado por este change.
- Hooks DB con efectos secundarios (promoción de super admin) viven en la config de `better-auth`. La capa de servicios no debe duplicarlos.
- El usuario confirmó: Vercel como deploy, móvil con Expo, decisiones de exploración cerradas (ver `proposal.md`).

A futuro: app móvil Expo con bearer tokens (`@better-auth/expo/client`), posible activación de `oidcProvider`, posibles integraciones de terceros. Todo esto requiere que el contrato HTTP sea estable, versionado y autodocumentado desde el día 1.

## Goals / Non-Goals

**Goals:**

- Exponer una REST API versionada `/v1/` consumible por web (Next), móvil (Expo) y terceros futuros, dentro del mismo proyecto y deploy.
- Concentrar la lógica de dominio en una capa de servicios pura (`web/lib/services/*`) sin dependencias de Next ni de Hono.
- Generar OpenAPI 3.x automáticamente desde schemas zod, sin paso de codegen manual.
- Permitir clientes TS con tipos end-to-end vía `hono/client` (`AppType`).
- Enforcement uniforme de autenticación (sesión `better-auth`) y autorización por organización (`orgId` del path) en todas las rutas REST que lo requieran.
- Manejo de errores consistente: errores de dominio (`DomainError`) traducidos a status HTTP estándar por un único error handler.
- Permitir que Server Actions existentes sigan funcionando y migren incrementalmente a llamar la nueva capa de servicios.

**Non-Goals:**

- NO se elimina ninguna Server Action en este change. Sólo se migran las estrictamente necesarias para los primeros endpoints REST que sirvan de patrón.
- NO se implementa la app móvil Expo. Se deja todo listo para que pueda integrarse.
- NO se activa `oidcProvider` de better-auth. Permanecerá como cookie + bearer (futuro `@better-auth/expo/client`).
- NO se implementa rate limiting, métricas avanzadas, websockets, push notifications, ni endpoints de archivos/uploads. Cada uno será su propio change.
- NO se cambia la configuración de base de datos, el adapter de Drizzle, los plugins existentes de better-auth (`organization`, `admin`) ni la lógica de promoción de super admin.
- NO se modifica el handler existente `web/app/api/auth/` de better-auth; convivirá con el nuevo `app/api/[[...route]]/route.ts` mediante prioridad de rutas estáticas de Next.

## Decisions

### 1. Montaje de Hono dentro de Next vía catch-all route

**Decisión:** Crear `web/app/api/[[...route]]/route.ts` que reexporta los métodos HTTP desde una instancia de Hono, usando el adapter de Next.

**Por qué:** El App Router de Next prioriza rutas estáticas sobre dinámicas, así que `app/api/auth/[...all]/route.ts` (better-auth) sigue ganando dentro de su prefijo. Hono atrapa todo lo demás bajo `/api/`. Un solo deploy, cero CORS para la web, tipos compartidos.

**Alternativas consideradas:**

- *Hono como servicio separado*: deploy independiente, mejor para Cloudflare Workers, pero introduce CORS, monorepo real y duplicación de auth. Descartado: el usuario confirmó Vercel como target.
- *Una `route.ts` por endpoint usando sólo Next*: pierde Hono como router y el OpenAPI generado se vuelve manual.

### 2. Router: `@hono/zod-openapi` (versión 0.19.x)

**Decisión:** Usar `@hono/zod-openapi` (no `hono` directo) como router. Cada endpoint se define con `createRoute({ method, path, request, responses, tags })` y un handler tipado.

**Por qué:**

- Genera OpenAPI 3.x automáticamente desde los schemas zod, sin codegen separado.
- Sigue exportando `AppType` para `hono/client` (RPC tipado).
- Reemplaza a `hono` como router (mismo `app.openapi(...)` en lugar de `app.get(...)`), zero overhead en runtime.
- Se fija la versión `0.19.x` porque la `1.x` exige `zod ^4`, incompatible con `better-auth` 1.3.10 y el resto del codebase que usa `zod ^3`. Cuando se planifique migrar el monorepo a zod 4 (change futuro), se sube a `@hono/zod-openapi@1`.

**Alternativas consideradas:**

- *Hono RPC puro*: sólo tipos TS, sin OpenAPI. Bloquea consumidores no-TS (Postman, terceros, futuros generadores).
- *tRPC*: excelente DX en TS, pero no expone REST estándar, costoso para clientes no-TS y poco familiar para apps móviles nativas.

### 3. Cliente: `hono/client` (RPC) + OpenAPI publicado

**Decisión:** Exportar `export type AppType = typeof app` desde `web/lib/api/app.ts`. Web y Expo consumen vía `hc<AppType>(baseUrl)`. La spec OpenAPI queda disponible como artefacto para terceros.

**Por qué:** zero codegen para TS, tipos end-to-end, y OpenAPI como contrato neutral cuando haga falta.

### 4. Capa de servicios: `web/lib/services/*`

**Decisión:** Cada dominio tiene una carpeta con servicios puros:

```
web/lib/services/
├── messages/
│   ├── service.ts        ← funciones de dominio
│   ├── schemas.ts        ← zod schemas (entrada/salida)
│   └── errors.ts         ← errores de dominio
├── orgs/
└── ...
```

Cada servicio recibe un **`ctx`** explícito con `{ db, auth, currentUser, currentOrg, logger }`, NO importa Next ni Hono. Devuelve datos o lanza `DomainError`.

**Por qué:** Hace la lógica testeable sin levantar Next, reutilizable desde Server Actions, Hono y futuras CLIs/workers, y obliga a inyectar contexto (sin singletons ocultos).

**Alternativas consideradas:**

- *Lógica en route handlers de Hono*: rápido a corto plazo, duplica código y bloquea Server Actions.
- *Lógica en Server Actions y que Hono las llame*: fuerza acoplamiento a Next y al runtime de RSC.

### 5. Adaptadores

**Decisión:** Server Actions existentes pasan a ser funciones cortas (típicamente <30 líneas) que:

1. Obtienen sesión vía `auth.api.getSession({ headers: await headers() })`.
2. Construyen `ctx`.
3. Llaman al servicio.
4. Hacen `revalidatePath` / `redirect` según necesidad de Next.

Las rutas Hono hacen lo equivalente:

1. Middleware de auth construye `ctx`.
2. Handler valida input (ya validado por `zod-openapi`), llama al servicio.
3. Retorna `c.json(result, status)`.

**Por qué:** ambos transportes terminan siendo "carcasa". Si un día se elimina uno, la lógica sigue.

### 6. Estructura del módulo API

```
web/lib/api/
├── app.ts                    ← instancia Hono raíz, /v1 mount, error handler
├── openapi.ts                ← doc + Scalar UI (sólo dev)
├── client.ts                 ← export AppType + hc helper
├── context.ts                ← tipo HonoEnv: Variables.{session, user, org}
├── errors.ts                 ← DomainError → HTTPException mapper
├── middlewares/
│   ├── auth.ts               ← requireSession
│   ├── org.ts                ← requireOrgMembership (lee :orgId del path)
│   └── logger.ts
└── routes/
    ├── v1/
    │   ├── index.ts          ← combina sub-routers
    │   ├── me.ts             ← /v1/me
    │   └── orgs/
    │       ├── index.ts
    │       └── [orgId]/
    │           └── ...       ← rutas por dominio
```

### 7. Versionado

**Decisión:** Todo se monta bajo `/v1/`. La instancia raíz hace `app.route("/v1", v1Router)`. No hay rutas REST fuera de `/v1/` (exceptuando `/api/auth/...` de better-auth, que vive antes y por fuera).

**Por qué:** breaking changes futuros tienen lugar natural; `v2` coexiste con `v1` durante migración.

### 8. Multi-tenancy: `orgId` en path + middleware

**Decisión:** Rutas tenant-scoped tienen forma `/v1/orgs/:orgId/...`. Un middleware `requireOrgMembership` resuelve la organización, verifica que el usuario autenticado es miembro y la inyecta en `c.var.org`. No se confía en "organización activa" de la sesión para REST (el cliente declara explícitamente sobre cuál opera).

**Por qué:** explícito, auditable, idempotente entre clientes web y móvil. La "organización activa" de cookie sirve para UX de la web; la REST debe ser sin estado.

**Alternativas consideradas:**

- *`orgId` en header (`X-Org-Id`)*: menos REST-idiomático y oculta el recurso.
- *`orgId` en cuerpo*: rompe convención REST y complica caching/observabilidad.

### 9. Autenticación: cookie hoy, plan bearer

**Decisión:** El middleware `requireSession` llama `auth.api.getSession({ headers: c.req.raw.headers })`. Better-auth ya entiende cookies; cuando se active bearer para móvil con `@better-auth/expo/client`, la misma llamada lo cubre (better-auth resuelve cookie o bearer transparentemente).

**Por qué:** una sola pieza para ambos transportes de credencial; no se ata el diseño al móvil antes de que exista.

### 10. Manejo de errores

**Decisión:** `web/lib/services/errors.ts` define `DomainError` con `code` (string) y `status` (HTTP sugerido). El error handler global de Hono mapea:

- `DomainError` → JSON `{ error: { code, message } }` con el status sugerido.
- `ZodError` (de input) → 400 `{ error: { code: "validation_error", issues } }`.
- Cualquier otro → 500 `{ error: { code: "internal_error" } }` con log estructurado.

Códigos canónicos iniciales: `unauthorized` (401), `forbidden` (403), `not_found` (404), `conflict` (409), `validation_error` (400), `rate_limited` (429, reservado), `internal_error` (500).

### 11. Documentación: Scalar en dev

**Decisión:** Servir `/v1/openapi.json` siempre, y `@scalar/hono-api-reference` en `/v1/docs` SÓLO cuando `process.env.NODE_ENV !== "production"`. Producción mantiene la spec accesible pero sin UI pública.

### 12. Endpoints piloto en este change

Para validar end-to-end con dos dominios distintos y dejar el patrón:

- `GET /v1/me` — devuelve usuario autenticado y lista de organizaciones (no requiere `orgId`).
- `GET /v1/orgs/:orgId` — devuelve datos de la organización (requiere membresía).
- `GET /v1/orgs/:orgId/members` — lista miembros (requiere membresía).

No se migran Server Actions en este change más allá de lo necesario para extraer los servicios que cubren estos endpoints. El resto de migración Server Actions → services es trabajo de changes posteriores.

### 13. Coexistencia con `app/api/auth/`

**Decisión:** No se toca `web/app/api/auth/[...all]/route.ts`. Por la prioridad de rutas estáticas de Next 16, ese path se resuelve antes que la catch-all de Hono.

**Verificación:** documentar en `tasks.md` la prueba manual (curl a `/api/auth/...` debe seguir respondiendo como antes).

## Risks / Trade-offs

- **Riesgo: doble camino para la misma operación** (Server Action + endpoint REST). → *Mitigación:* ambos delegan en el mismo servicio. La duplicación es de "transporte", no de lógica. Lint check opcional en changes futuros para detectar lógica en handlers.
- **Riesgo: better-auth catch-all colisiona con Hono catch-all.** → *Mitigación:* Next prioriza rutas estáticas; `app/api/auth/[...all]/route.ts` ya gana. Test manual obligatorio en `tasks.md`.
- **Riesgo: Edge runtime incompatible con algunas deps.** → *Mitigación:* el route handler corre por defecto en Node (que es lo que necesitan Drizzle/Neon en este proyecto). No se fuerza `runtime = "edge"`.
- **Riesgo: tamaño del bundle de Next crece con Scalar UI.** → *Mitigación:* Scalar sólo se monta en desarrollo (`NODE_ENV !== "production"`). La spec en sí es JSON, peso despreciable.
- **Trade-off: acoplamiento a Hono.** → *Aceptado:* la capa de servicios es independiente; cambiar de router es local a `lib/api/`.
- **Trade-off: `@hono/zod-openapi` es más verboso que `hono` puro.** → *Aceptado:* el costo es upfront por endpoint, el beneficio (spec + tipos + validación) es continuo.
- **Riesgo: divergencia entre cookies (web) y bearer (móvil) en el mismo endpoint.** → *Mitigación:* el middleware llama una sola función de better-auth; no hay dos caminos. Cuando se agregue el plugin bearer de better-auth, será change suyo y no rompe el contrato HTTP.
- **Riesgo: el patrón `ctx` con `db` inyectado se ignora y los servicios importan `db` directo.** → *Mitigación:* convención documentada en `service-layer` spec + revisión en PR. ESLint rule opcional en change futuro.

## Migration Plan

1. **Sin downtime, sin breaking changes.** Toda la API es nueva; Server Actions existentes siguen funcionando.
2. Orden de despliegue:
   1. Añadir capa `lib/services/` con servicios piloto (me, orgs).
   2. Añadir `lib/api/` (app, middlewares, errors, openapi).
   3. Añadir `app/api/[[...route]]/route.ts` y verificar que `/api/auth/...` sigue funcionando.
   4. Migrar (sólo) las Server Actions de los servicios piloto para que llamen al nuevo `lib/services`.
   5. Smoke test manual: web sigue funcionando, REST responde correctamente, docs disponibles en dev.
3. Rollback: revertir el commit del catch-all. La capa de servicios y los cambios en Server Actions son retro-compatibles y no requieren rollback.

# `lib/api/` — Adaptador REST (Hono + OpenAPI)

REST API montada dentro de Next vía `web/app/api/[[...route]]/route.ts`.
Router: `@hono/zod-openapi` (0.19.x, compatible con zod 3).
Cliente tipado: `hono/client` consumiendo `AppType`.

## Estructura

```
lib/api/
├── app.ts                 ← instancia raíz Hono, basePath /api, /v1 mount, openapi, Scalar
├── context.ts             ← HonoEnv (Variables.{session, user, org?})
├── errors.ts              ← onError (DomainError, ZodError, HTTPException → JSON)
├── build-ctx.ts           ← buildServiceContext / buildTenantServiceContext (puente Hono → servicios)
├── server-ctx.ts          ← buildServerServiceContext (puente Next → servicios)
├── client.ts              ← createApiClient(baseUrl) = hc<AppType>(baseUrl)
├── server-client.ts       ← getServerApiClient() (reenvía cookie de sesión)
├── middlewares/
│   ├── auth.ts            ← requireSession
│   └── org.ts             ← requireOrgMembership (lee :orgId del path)
└── routes/
    └── v1/
        ├── index.ts       ← combina sub-routers
        ├── me.ts          ← GET /me
        └── orgs/
            ├── get-org.ts
            └── list-members.ts
```

## Convenciones

- **Versionado obligatorio.** Todas las rutas viven bajo `/api/v1/...`. Cuando llegue
  un breaking change, se añade `/api/v2/...` en paralelo.
- **Multi-tenancy en el path.** Rutas tenant-scoped: `/api/v1/orgs/:orgId/...`.
  La organización del path es la fuente única de verdad. La "organización activa"
  de la cookie NO influye en REST.
- **Schemas de input/output viven en `lib/services/<dominio>/schemas.ts`.** Las rutas
  REST los reusan; nunca redefinas un schema duplicado.
- **Una ruta = un archivo + una instancia `OpenAPIHono`.** Componer en `routes/v1/index.ts`.

## Cómo añadir un endpoint

1. Si es nuevo dominio, crea `lib/services/<dominio>/{schemas.ts, service.ts}` con
   función pura `op(ctx, args): Promise<DTO>`.
2. Crea `lib/api/routes/v1/<area>/<op>.ts` con `createRoute({...})` + `OpenAPIHono.openapi(...)`.
3. Añade middleware `requireSession` (siempre) y `requireOrgMembership` si la ruta es tenant-scoped.
4. Móntalo en `routes/v1/index.ts` con `.route("/", <router>)`.

## Errores

Lanza `DomainError` desde el servicio y olvídate del status. El `onError` global lo
traduce al contrato:

```json
{ "error": { "code": "forbidden", "message": "..." } }
```

Códigos canónicos: `unauthorized` (401), `forbidden` (403), `not_found` (404),
`conflict` (409), `validation_error` (400), `rate_limited` (429, reservado),
`internal_error` (500).

## Docs locales

- Spec JSON: `http://localhost:3000/api/v1/openapi.json` (siempre disponible).
- UI interactiva (Scalar): `http://localhost:3000/api/v1/docs` (sólo `NODE_ENV !== "production"`).

## Cliente tipado

```ts
// Server Component / Server Action
import { getServerApiClient } from "@/lib/api/server-client";
const api = await getServerApiClient();
const res = await api.api.v1.me.$get();
const data = await res.json();

// Expo / browser
import { createApiClient } from "@/lib/api/client";
const api = createApiClient(EXPO_PUBLIC_API_URL);
const res = await api.api.v1.me.$get();
```

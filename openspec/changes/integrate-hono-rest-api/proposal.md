## Why

El proyecto requerirá una aplicación móvil (Expo / React Native) que consuma la misma lógica de negocio que la web. Hoy toda la lógica vive acoplada al transporte de Next.js (Server Actions y Route Handlers), lo que impide reutilizarla desde un cliente nativo. Necesitamos una REST API estable, versionada y autodocumentada que sirva tanto a la web actual como al móvil futuro, sin perder las ventajas del App Router (RSC, cache, Server Actions).

## What Changes

- Se introduce **Hono** montado dentro del proyecto Next en `web/app/api/[[...route]]/route.ts` como router REST.
- Se adopta `@hono/zod-openapi` para generar especificación OpenAPI 3.x automáticamente desde schemas zod, y se expone `AppType` para que `hono/client` (RPC tipado) funcione en clientes TypeScript (web y Expo).
- Se introduce una **capa de servicios** (`web/lib/services/*`) con la lógica de dominio en módulos puros, agnósticos del transporte. Server Actions existentes y rutas Hono pasan a ser adaptadores delgados que invocan esos servicios.
- Versionado de la API desde el día 1 bajo el prefijo `/v1/`.
- Multi-tenancy explícito en el path: rutas con forma `/v1/orgs/:orgId/...` (modelo Slack: el usuario puede pertenecer a varias organizaciones y saltar entre ellas).
- Autenticación: se mantiene `better-auth` con cookies para la web; las rutas Hono aceptan la misma sesión de better-auth para clientes con cookies y dejan preparado el camino para `@better-auth/expo/client` (bearer + SecureStore) cuando inicie el móvil.
- Documentación interactiva (Swagger UI / Scalar) servida en desarrollo.
- Las Server Actions **no se eliminan**; conviven con la API REST y se migran incrementalmente a llamar los nuevos servicios.

## Capabilities

### New Capabilities

- `rest-api`: contrato REST público versionado `/v1/`, montado vía Hono dentro de Next, con OpenAPI generado, cliente RPC tipado, manejo uniforme de errores, autenticación delegada a `better-auth` y enforcement de multi-tenancy por `orgId` en el path.
- `service-layer`: capa de servicios de dominio en `web/lib/services/*` independiente del transporte. Define cómo se estructuran los servicios, sus contratos de entrada/salida, manejo de errores de dominio y consumo desde Server Actions y rutas Hono.

### Modified Capabilities

- `auth`: extiende los requisitos de autenticación para describir el comportamiento de la sesión sobre rutas REST (cookies en web, plan de bearer para móvil) y la verificación de membresía a la organización del path en rutas `/v1/orgs/:orgId/...`.

## Impact

- **Código nuevo**: `web/app/api/[[...route]]/route.ts`, `web/lib/api/` (Hono app, schemas zod compartidos, middlewares, error handling, OpenAPI), `web/lib/services/` (capa de dominio).
- **Código modificado**: Server Actions de la zona `(app)` se reescriben como adaptadores que delegan en `lib/services` (alcance acotado a los servicios necesarios para los primeros endpoints REST; el resto se migra incrementalmente en changes futuros).
- **Dependencias nuevas**: `hono`, `@hono/zod-openapi`, `@scalar/hono-api-reference` (UI de docs en dev).
- **Auth**: se reusa `web/lib/auth/` sin cambios estructurales; sólo se añade un middleware Hono que adapta `auth.api.getSession` al contexto de la request.
- **Deploy**: sigue siendo único en Vercel. La API vive en el mismo proceso de Next, sin CORS ni infraestructura adicional.
- **Out of scope (no en este change)**: app Expo, `oidcProvider` plugin de better-auth, rate limiting, observabilidad avanzada, websockets, push notifications, migración completa de Server Actions.

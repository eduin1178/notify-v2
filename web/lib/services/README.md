# `lib/services/` — Capa de servicios de dominio

Lógica de negocio en módulos puros, agnósticos del transporte. Reutilizable desde
Server Actions, rutas Hono, jobs, CLIs, tests.

## Regla principal

**Ningún archivo bajo `lib/services/` PUEDE importar:**

- `next/*`
- `hono`, `@hono/*`
- Nada bajo `web/app/**`

Si necesitas un puente con Next, vive en `web/lib/api/server-ctx.ts`. Si necesitas
un puente con Hono, vive en `web/lib/api/build-ctx.ts`. Esos puentes son la
ÚNICA capa permitida que mezcla transporte y dominio.

## Estructura por dominio

```
lib/services/
├── errors.ts          ← DomainError + helpers (unauthorized/forbidden/notFound/conflict)
├── context.ts         ← ServiceContext, TenantServiceContext
├── logger.ts          ← Logger mínimo (reemplazable)
└── <dominio>/
    ├── schemas.ts     ← zod schemas (Input/Output DTOs)
    └── service.ts     ← funciones puras (ctx, args) → Promise<DTO>
```

## Patrón obligatorio: `ctx` explícito

Toda función pública recibe `ctx` como primer argumento:

```ts
export async function getOrg(ctx: ServiceContext, orgId: string): Promise<OrganizationDtoT> {
  // ctx.db, ctx.currentUser, ctx.logger, opcionalmente ctx.currentOrg
}
```

Las funciones tenant-scoped exigen `TenantServiceContext` (con `currentOrg`).

**Prohibido:** leer `db` directo de un import global dentro del cuerpo del servicio,
leer la sesión desde un singleton, o usar `headers()` de Next.

## Errores

Lanza `DomainError` (o los helpers de `DomainErrors`) para condiciones de dominio.
Cualquier otro error (`Error` estándar) se trata como bug y será `500` para el
cliente.

```ts
if (!org) throw DomainErrors.notFound("Organización no encontrada.");
if (!isMember) throw DomainErrors.forbidden("No eres miembro de esta organización.");
```

## Adaptadores

- **Hono / REST**: `web/lib/api/routes/v1/**` — `createRoute` + `c.req.valid("param")` + `buildServiceContext(c)` + `c.json(await servicio(ctx, ...))`.
- **Next / web**: Server Component o Server Action — `await buildServerServiceContext()` + `await servicio(ctx, ...)`.

Los adaptadores **NO contienen lógica de dominio**, sólo traducen transporte ↔ servicio.

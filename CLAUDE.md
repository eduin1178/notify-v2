# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

This is a multi-folder repo (not a pnpm workspace — the root `pnpm-workspace.yaml` was removed). The Next.js app lives in [web/](web/). Spec-driven development artifacts live in [openspec/](openspec/).

- [web/](web/) — Next.js 16 application (App Router, React 19, TypeScript, Tailwind v4, shadcn/ui)
- [openspec/](openspec/) — OpenSpec change proposals, specs, and exploration notes for this codebase

All commands below run from inside `web/` unless noted.

## Commands

Package manager: **pnpm** (`packageManager` pinned in [web/package.json](web/package.json)).

```bash
cd web
pnpm install      # install deps
pnpm dev          # next dev — local dev server
pnpm build        # next build — production build
pnpm start        # next start — serve production build
pnpm lint         # eslint (flat config in eslint.config.mjs)
```

No test runner is configured yet.

## Architecture Notes

- **Next.js App Router (Next 16, React 19)**. Entry points: [web/app/layout.tsx](web/app/layout.tsx) and [web/app/page.tsx](web/app/page.tsx). `globals.css` lives in [web/app/globals.css](web/app/globals.css) and is the Tailwind v4 entry (Tailwind v4 uses CSS-first config via `@import`/`@theme` — no `tailwind.config.js`).
- **Styling stack**: Tailwind v4 (via `@tailwindcss/postcss`), `tw-animate-css`, `class-variance-authority`, `tailwind-merge`, `clsx`. The `cn()` utility lives in [web/lib/utils.ts](web/lib/utils.ts).
- **shadcn/ui** is configured in [web/components.json](web/components.json):
  - Icon library: `@phosphor-icons/react` (use this, not Lucide)
  - Components go in `@/components/ui` (e.g. [web/components/ui/button.tsx](web/components/ui/button.tsx)); shared utilities in `@/lib`; hooks alias is `@/hooks`
  - Add components with `pnpm dlx shadcn@latest add <component>` from inside `web/`
- **Path aliases** are defined in [web/tsconfig.json](web/tsconfig.json) — `@/*` maps to `web/*`.
- **NextJs 16 usa proxy.ts en lugar de middleware.ts** Para conocer su implementación puedes consultar su documentación

## REST API + capa de servicios (OBLIGATORIO)

El proyecto separa **lógica de dominio** del **transporte**. Esta separación
existe porque la misma lógica debe servir a la web (Next) y a la app móvil
(Expo). Reglas no negociables:

1. **`web/lib/services/<dominio>/`** contiene la lógica de negocio en módulos
   puros. **PROHIBIDO** importar desde estos archivos: `next/*`, `hono`,
   `@hono/*`, ni nada bajo `web/app/**`. Si necesitas un dato o sesión, llega
   por `ctx` (primer argumento). Ver [web/lib/services/README.md](web/lib/services/README.md).

2. **`ctx` explícito.** Cada función pública de servicio recibe
   `ServiceContext` (o `TenantServiceContext`) como primer argumento.
   Nunca leas `db`, sesión, o `headers()` desde un singleton dentro del cuerpo.

3. **Errores de dominio: `DomainError`** (`web/lib/services/errors.ts`).
   Lánzalos con `DomainErrors.{unauthorized,forbidden,notFound,conflict}(...)`.
   El error handler global los traduce a HTTP. No mezcles `DomainError` con
   errores de programación (`Error` estándar → 500).

4. **Adaptadores delgados.** Server Actions, Server Components y rutas Hono son
   "carcasa": obtienen sesión, construyen `ctx`, llaman al servicio, traducen
   al transporte. **No deben contener queries de Drizzle directas ni reglas de
   autorización propias del dominio.** Eso vive en `lib/services/`.

5. **REST API bajo `/api/v1/`.** Versionado desde día 1. Montada con Hono +
   `@hono/zod-openapi` en [web/app/api/[[...route]]/route.ts](web/app/api/[[...route]]/route.ts).
   Ver [web/lib/api/README.md](web/lib/api/README.md). El handler de
   `better-auth` (`/api/auth/...`) vive antes y por fuera de esta convención.

6. **Multi-tenancy en el path.** Rutas tenant-scoped: `/api/v1/orgs/:orgId/...`.
   La organización del path es la **fuente única de verdad** para REST. La
   "organización activa" de la cookie NO influye en endpoints REST.

7. **Schemas de input/output viven en `lib/services/<dominio>/schemas.ts`** y se
   reutilizan en `createRoute(...)` de Hono. NO redefinas schemas duplicados en
   las rutas.

8. **Puentes Next ↔ servicios.**
   - Server Components / Server Actions: `await buildServerServiceContext()`
     desde [web/lib/api/server-ctx.ts](web/lib/api/server-ctx.ts).
   - Hono: `buildServiceContext(c)` / `buildTenantServiceContext(c)` desde
     [web/lib/api/build-ctx.ts](web/lib/api/build-ctx.ts).
   - Ambos puentes viven en `lib/api/` (no en `lib/services/`) porque importan
     `next/*` o `hono`.

9. **Versión de `zod`: 3.x.** El proyecto usa `zod ^3`. `@hono/zod-openapi`
   está fijado en `0.19.x` por compatibilidad. NO subas a `@hono/zod-openapi@1`
   sin migrar el resto del codebase a `zod 4` (incluye `better-auth`).

10. **Cliente tipado: `hono/client`.** Web usa `getServerApiClient()` (reenvía
    cookie). Expo usará `createApiClient(EXPO_PUBLIC_API_URL)` cuando inicie.
    Los tipos vienen de `AppType` (exportado por `web/lib/api/app.ts`) — sin
    codegen.

## OpenSpec Workflow

This project uses OpenSpec (see [openspec/](openspec/)) for spec-driven changes. Change proposals live under `openspec/changes/`, capability specs under `openspec/specs/`. When making non-trivial changes, prefer creating/continuing a change in `openspec/` rather than ad-hoc edits. Use `/sdd-*` or `/opsx:*` skills to drive the workflow.

## Conventions

- **Conventional commits only.** Do not add `Co-Authored-By` or AI attribution lines.
- **User-facing copy is Spanish neutral (tú, never voseo).** This applies to all UI strings, labels, errors, placeholders, and product-visible text. See the global rule in `~/.claude/CLAUDE.md`.

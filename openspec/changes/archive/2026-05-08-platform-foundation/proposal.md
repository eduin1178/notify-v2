## Why

El repositorio sólo tiene scaffold de Next.js + shadcn — no hay base de datos, ni ORM, ni patrón de acceso a datos, ni gestión de secretos, ni CI. La constitución (§2.1) declara el aislamiento multi-tenant absoluto como riesgo #1 del negocio (R2 de la visión: catastrófico) y obliga a que TODO acceso a datos pase por un repository pattern que inyecte `organization_id`. Si la primera tabla de dominio se crea antes de existir esa abstracción, la disciplina se rompe el día 1 y cualquier feature posterior queda contaminada. Esta propuesta crea el sustrato técnico — sin features visibles para el usuario — sobre el que se construirán todas las capabilities funcionales.

## What Changes

- Configurar conexión a Postgres en Neon vía Drizzle (cliente, schema base, sistema de migraciones, branching por entorno).
- Definir estructura de carpetas hexagonal en `src/` (`domain/`, `application/`, `infrastructure/`) con la regla "dominio nunca importa adapters" enforced por ESLint.
- Crear el `BaseRepository` abstracto que recibe `organization_id` en construcción y lo inyecta en TODA query. Es físicamente imposible obtener una instancia sin un `organization_id` explícito.
- Definir `TenantContext` (objeto que viaja por la request) que provee el `organization_id` resuelto desde la sesión; los repositorios sólo se instancian a partir de él.
- Implementar helper de cifrado simétrico de columnas (AES-256-GCM con key rotativa vía variable de entorno) para futuras credenciales BYO (Cloud API tokens, WAHA sessions, OpenRouter API keys).
- Establecer gestión de variables de entorno con validación en boot (Zod schema) — la app no arranca si falta una variable obligatoria.
- Configurar ESLint + Prettier con reglas que bloqueen imports `infrastructure → domain` invertidos.
- Configurar pipeline de CI (GitHub Actions) con: lint, type-check, test runner. CI rojo bloquea merge.
- Configurar Vitest como test runner con utilidades base para tests de aislamiento multi-tenant (factories de orgs, asserts de leak-zero).
- Documentar en `src/AGENTS.md` las reglas de oro de la capa: nunca instanciar un repositorio sin `TenantContext`, nunca persistir credenciales BYO sin pasar por el helper de cifrado.

**No introduce features de usuario.** No hay UI nueva, no hay rutas nuevas, no hay auth todavía. Es plomería pura.

## Capabilities

### New Capabilities
- `tenancy-foundation`: contrato de aislamiento multi-tenant a nivel de capa de datos. Garantiza que ninguna query se ejecuta sin `organization_id`, que el aislamiento se valida con tests automatizados, y que las columnas de credenciales BYO se cifran en reposo. Es el cumplimiento operativo del principio constitucional §2.1 y §2.8.

### Modified Capabilities
*(Ninguna — no existen specs todavía.)*

## Impact

- **Código afectado**: todo `src/` salvo `app/page.tsx`, `app/layout.tsx`, `components/ui/*` (preset shadcn) y `lib/utils.ts`.
- **Nuevas dependencias runtime**: `drizzle-orm`, `drizzle-kit`, `pg` (o `@neondatabase/serverless`), `zod` (validación de env y de inputs futuras).
- **Nuevas dependencias dev**: `vitest`, `@vitest/coverage-v8`, `eslint-plugin-boundaries` (o equivalente para bloquear imports inválidos), `tsx` para ejecutar scripts de migración.
- **Infraestructura externa**: requiere proyecto Neon creado con dos branches (dev, main) y URL de conexión en secreto de CI.
- **Sistemas no afectados**: Trigger.dev, Pusher, R2, Wompi, OpenRouter — todos quedan diferidos a sus changes correspondientes.
- **Review obligatorio**: SÍ. Esta propuesta toca el repository pattern y el helper de cifrado de credenciales BYO; ambos son zonas que la constitución (§4) marca como review obligatorio. Adicionalmente, el `BaseRepository` se convertirá en código que toda capability futura importará — un bug acá compromete principios §2.1 y §2.8 en cascada.

## Riesgos multi-tenant

- **R-PF-1**: si `BaseRepository` permite escapar el filtro por `organization_id` (ej. método `raw()` sin guarda), todo el modelo de aislamiento se rompe. Mitigación: API del repositorio cerrada (no exponer cliente Drizzle crudo), tests de aislamiento que intentan leer datos cross-org y deben fallar.
- **R-PF-2**: si el helper de cifrado se introduce DESPUÉS de la primera tabla con credenciales BYO, hay riesgo de columnas en texto plano migradas en caliente. Mitigación: este change crea el helper antes de cualquier change que persista credenciales BYO.

## Non-goals

- No incluye Better-Auth ni concepto de `User`/`Organization` en el dominio (eso es `identity-tenancy`, change siguiente).
- No incluye Trigger.dev, Pusher, R2 ni Wompi; cada uno entra con su capability correspondiente.
- No incluye CI/CD de despliegue (sólo CI de validación). El despliegue se aborda cuando exista algo desplegable.
- No incluye Postgres RLS (decisión arquitectónica inmutable §6.6 de la constitución).
- No incluye seed data ni fixtures de dominio (no hay dominio todavía).

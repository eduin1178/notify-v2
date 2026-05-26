<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Constitution

Antes de escribir o modificar código en este proyecto, leé y respetá [openspec/constitution.md](../openspec/constitution.md). Es la fuente de verdad para:

- **Misión y modelo de negocio**: Notify es SaaS multi-tenant BYO Cloud API. EduNet NO intermedia mensajería ni factura mensajes.
- **Principios no negociables**: aislamiento multi-tenant via repository pattern (`organization_id` en toda tabla de dominio), consentimiento auditable, Habeas Data self-service, webhooks hardened (HMAC + replay protection), snapshot de plantilla al lanzar campaña, audit log append-only, cifrado en reposo de credenciales BYO.
- **Stack decidido**: Next.js 16 App Router + TS + shadcn/ui, Better-Auth (plugin Organizations), Drizzle, Postgres/Neon, Trigger.dev v3, Pusher, Cloudflare R2, Wompi.
- **Convenciones**: código en inglés, UI en español. Arquitectura hexagonal en `MessagingPort`, `PaymentGatewayPort`, `AiGatewayPort` — el dominio nunca importa adapters. Conventional Commits sin atribución a IA.
- **Tests obligatorios**: aislamiento multi-tenant siempre; reglas críticas de campañas, consent, billing, automation engine; verificación de firmas de webhooks; adapters con fixtures de Cloud API/WAHA.
- **Límites duros**: no Postgres RLS en MVP, no API pública para clientes en MVP, no app móvil, no integraciones nativas con CRMs externos, no GDPR (aplica Habeas Data CO).
- **Decisiones inmutables**: Organización es el único nivel de tenant. Automation engine lineal (Evento → Condiciones AND/OR → Acciones[]) — sin DAG. Trigger.dev v3 es el motor durable. Outbox pattern para eventos cross-boundary.

Si una instrucción del usuario contradice la constitución, pausá y señalá el conflicto antes de proceder.

- **Proyecto** Localizado en la carpeta /src, no es necesario volver a crearlo.

# Platform foundation — reglas de oro

Estas reglas son consecuencia directa de los principios constitucionales §2.1 (aislamiento multi-tenant) y §2.8 (cifrado de credenciales BYO). **Romperlas no es una opción.** Si una feature las contradice, parás y planteás el conflicto antes de tocar código.

## NUNCA

1. **NUNCA instanciar un repositorio sin `TenantContext` activo.** El constructor de `BaseRepository` lee `getTenantContext()` desde `AsyncLocalStorage`. Si no estás dentro de `runWithTenant(...)`, lanza `Error("TenantContext not initialized — orphan request")`. No hay escape hatch — y no se agrega.
2. **NUNCA persistir credenciales BYO sin pasar por `encrypt()`.** Cloud API tokens, sesiones WAHA, API keys de OpenRouter del cliente: TODOS van por `infrastructure/crypto/encryption.ts`. El valor en la DB es del shape `v1:iv:ct:tag`. Una columna BYO en texto plano es bug, no decisión.
3. **NUNCA exportar `db` o `dbTx` (`getDbTx`) fuera de `infrastructure/db/repositories/**`.** El cliente Drizzle es detalle interno — los consumidores externos (`application/`, `app/`, otros directorios de `infrastructure/`) usan repositorios. Si necesitás "una query rara", primero proponé extender el repo. Si justificás un escape, pasa por review.
4. **NUNCA romper los boundaries hexagonales.** ESLint los enforce, pero la regla en tu cabeza es: `domain` no importa adapters; `application` no importa `infrastructure`; `infrastructure` no importa `app`. `import type` desde `domain/**` está permitido siempre.

## Flujo para crear un repositorio nuevo

1. **Schema Drizzle** en `src/infrastructure/db/schema/<feature>.ts` con columna `organization_id` (string, not null, FK a `organizations.id`).
2. **Generar migration**: `pnpm db:generate`. Inspeccioná el SQL en `infrastructure/db/migrations/`.
3. **Repositorio concreto** en `src/infrastructure/db/repositories/<feature>Repository.ts` extendiendo `BaseRepository<TTable>`:
   - `protected readonly table = <featureTable>` — el schema Drizzle
   - Métodos públicos (`findByX`, `create`, etc.) componen `this.scopedWhere()` para reads y `this.withOrgId(input)` para inserts
   - El tipo `Insertable<Feature>` excluye `organizationId` del shape recibido
4. **Test de aislamiento obligatorio** en `<feature>Repository.test.ts`:
   ```ts
   import { assertTenantIsolation } from "../../../test/assertTenantIsolation";

   it("isolates rows per organization", async () => {
     await assertTenantIsolation(
       (ctx) => new FeatureRepository(ctx),
       { /* sample insertable, sin organizationId */ },
     );
   });
   ```
   Sin este test el repo NO entra a `main`.
5. **Verificación pre-commit**: `pnpm lint && pnpm typecheck && pnpm test`. Los tres en verde, sin excepciones.

## Cómo agregar una columna BYO cifrada

1. En el schema, declarar la columna como `text("token").notNull()` — el tipo de DB es texto, no `Encrypted` (el formato `v1:...` cabe en text).
2. En el repositorio, `create()` invoca `encrypt(plaintext)` antes del insert; `find...()` invoca `decrypt(row.token)` antes de devolver.
3. JAMÁS exponer la columna cruda en una API de salida — el dominio devuelve el plaintext (post-decrypt) o un wrapper opaco.
4. Test obligatorio: round-trip del valor (insert plaintext → DB tiene `v1:...` → read devuelve plaintext igual). Asertar que la DB NO contiene el plaintext (query directa por la columna).


## Context

El repositorio de Notify está en estado scaffold (Next.js 16 + shadcn) sin DB, ORM, ni patrón de acceso a datos. La constitución (§2.1, §2.8) declara dos invariantes no negociables que TIENEN que existir antes de la primera línea de código de dominio:

- **Aislamiento multi-tenant absoluto**: ninguna query puede ejecutarse sin un `organization_id` explícito (R2 de la visión: catastrófico, fin del negocio si se incumple).
- **Cifrado en reposo de credenciales BYO**: tokens Cloud API, sesiones WAHA y keys OpenRouter del cliente se almacenan cifrados a nivel de columna.

Si la primera tabla de dominio se crea antes de que existan estas dos abstracciones, la disciplina se rompe el día 1. Este design define la forma exacta de la plomería para que las invariantes sean enforced por construcción, no por convención.

**Stakeholders**: único desarrollador (solo dev), equipo EduNet como reviewer en PRs que toquen estas piezas (constitución §4).

**Restricciones**: Next.js 16 (Node ≥ 20), Drizzle como ORM decidido, Neon Postgres como base de datos decidida, sin Postgres RLS (decisión arquitectónica inmutable §6.6 de la constitución), 2 meses de runway.

## Goals / Non-Goals

**Goals**
- Que sea **físicamente imposible** ejecutar una query de dominio sin `organization_id`.
- Que el cifrado de credenciales BYO sea un único call-site (`encrypt()`/`decrypt()`) que el resto del código no pueda saltar.
- Que la separación hexagonal `domain → application → infrastructure` esté enforced por ESLint, no por respeto al README.
- Que el primer test de aislamiento multi-tenant exista antes que el primer caso de uso.
- Que `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm typecheck` y CI sean verdes con código mínimo.

**Non-Goals**
- No definir el modelo de dominio de identity/tenancy (eso es `identity-tenancy`, change siguiente). Acá solo se crea la **infra** que ese change consumirá.
- No exponer rutas, UI ni endpoints públicos.
- No incluir Trigger.dev, Pusher, R2, Wompi, OpenRouter — cada uno entra con su capability.
- No CI/CD de despliegue (solo CI de validación: lint + typecheck + test).
- No envelope encryption con KMS (overhead operativo sin clientes; se prepara el hook de rotación pero la primera versión es key única en env).

## Decisions

### D1. Drivers Neon: `neon-http` por defecto + `neon-serverless` para transacciones

Drizzle tiene soporte nativo para ambos. `neon-http` es óptimo para queries individuales (más rápido en single-shot, sin TCP, edge-compatible). `neon-serverless` (WebSockets) es necesario cuando hay transacciones interactivas o pooling.

**Implementación**: `infrastructure/db/client.ts` exporta `db` (HTTP, default) y `dbTx` (serverless, lazy, solo para flujos transaccionales como import jobs futuros). Las migraciones via `drizzle-kit` usan el cliente serverless directo.

**Alternativa descartada**: `pg`/`postgres.js` con TCP directo. Razón: pierde la ventaja edge de Neon y agrega connection pooling manual; Vercel/Next.js serverless funciones no toleran conexiones long-lived.

### D2. Layout hexagonal `src/{domain,application,infrastructure}` con boundaries enforced

```
src/
├── app/                       # Next.js App Router (existente)
├── components/                # UI (existente)
├── lib/                       # utils UI (existente)
├── domain/                    # Entidades, value objects, ports (puro TS, sin imports infra)
├── application/               # Use cases, services. Importa domain. Recibe ports.
├── infrastructure/            # Adapters concretos: drizzle, neon, crypto, env, http
│   ├── db/
│   │   ├── client.ts          # db, dbTx
│   │   ├── schema/            # Drizzle schemas (uno por capability)
│   │   ├── migrations/        # drizzle-kit output
│   │   └── repositories/      # BaseRepository + implementaciones
│   ├── crypto/
│   │   └── encryption.ts      # encrypt/decrypt + key versioning
│   ├── env/
│   │   └── env.ts             # Zod-validated env, parseado en module-load
│   └── tenant/
│       └── context.ts         # TenantContext + AsyncLocalStorage helpers
└── test/                      # Test utilities (factories, isolation asserts)
```

`eslint-plugin-boundaries` enforces:
- `domain/**` no puede importar de `application/**` ni de `infrastructure/**` ni de `app/**`.
- `application/**` no puede importar de `infrastructure/**` ni de `app/**`.
- `infrastructure/**` no puede importar de `app/**`.

**Alternativa descartada**: feature-folder (Screaming Architecture). Razón: con el dominio aún sin definir y solo plomería, la separación por capa es más útil que por feature. Cuando aparezcan capabilities reales, se evalúa migrar a slices verticales.

### D3. `TenantContext` con AsyncLocalStorage

`TenantContext = { organizationId: string; userId: string; isSuperAdmin: boolean }` se inicializa en el middleware/server-action boundary una sola vez por request, y se propaga implícitamente vía `AsyncLocalStorage` (Node 20+ nativo). Las funciones de dominio y aplicación lo leen con `getTenantContext()` (lanza si no existe).

```typescript
// infrastructure/tenant/context.ts
const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return tenantStorage.run(ctx, fn);
}

export function getTenantContext(): TenantContext {
  const ctx = tenantStorage.getStore();
  if (!ctx) throw new Error("TenantContext not initialized — orphan request");
  return ctx;
}
```

**Alternativa descartada**: pasar `organizationId` como parámetro explícito en cada función. Razón: 5 niveles abajo en una use-case, alguien va a olvidarlo, y el typescript no puede enforcar transitividad. AsyncLocalStorage hace que olvidar = error en runtime detectable, no leak silencioso.

### D4. `BaseRepository` cerrado, sin escape hatch público

```typescript
// infrastructure/db/repositories/base.ts
export abstract class BaseRepository<T extends { organizationId: string }> {
  protected readonly orgId: string;

  constructor(ctx: TenantContext = getTenantContext()) {
    this.orgId = ctx.organizationId;
  }

  protected scopedWhere() {
    return eq(this.table.organizationId, this.orgId);
  }
  // ningún método público que devuelva el cliente Drizzle crudo
}
```

Cada repositorio concreto extiende `BaseRepository` y todo método (find/insert/update/delete) compone `scopedWhere()` automáticamente. No se exporta `db` desde `infrastructure/db/client.ts` fuera del paquete `infrastructure/db/repositories/**`. Para consumidores externos, los repos son la única vía.

**Alternativa descartada**: exportar `db` y confiar en que cada call-site filtre manualmente. Razón: rompe principio §2.1 — es disciplina, no construcción. Un solo bug y se filtran datos cross-org.

### D5. Cifrado AES-256-GCM con key versionada

```typescript
// infrastructure/crypto/encryption.ts
export type Encrypted = `v${number}:${string}`; // ej: "v1:base64iv:base64ciphertext:base64tag"

export function encrypt(plaintext: string): Encrypted { /* AES-256-GCM con ENCRYPTION_KEY_V1 */ }
export function decrypt(value: Encrypted): string { /* dispatch por versión de key */ }
```

Key única en MVP (`ENCRYPTION_KEY_V1` en env, base64 de 32 bytes). El prefijo `v1:` permite agregar `v2`, `v3` a futuro y rotar sin migración destructiva: el `decrypt` despacha por versión, los nuevos `encrypt` siempre usan la versión actual.

**Alternativa descartada**: envelope encryption con KMS (AWS, Vault). Razón: overhead operativo desproporcionado para 0 clientes; se pre-cablea la rotación con el versionado para que migrar a KMS post-MVP no rompa filas existentes.

### D6. Env validado con Zod en module-load

```typescript
// infrastructure/env/env.ts
const schema = z.object({
  DATABASE_URL: z.string().url(),
  ENCRYPTION_KEY_V1: z.string().refine((v) => Buffer.from(v, "base64").length === 32),
  NODE_ENV: z.enum(["development", "test", "production"]),
});
export const env = schema.parse(process.env); // throws si falta algo
```

Cualquier `import { env } from "infrastructure/env/env"` valida al cargar. La app no arranca sin DB ni sin encryption key.

**Alternativa descartada**: validar en cada call-site. Razón: errores en runtime tarde, no en boot.

### D7. Vitest como test runner + utilidad de aislamiento

`assertTenantIsolation(repoFactory)` es una helper genérica que: (1) crea dos `TenantContext` distintos, (2) inserta una fila vía `runWithTenant(ctxA, ...)`, (3) intenta leerla vía `runWithTenant(ctxB, ...)` y debe obtener vacío. Cualquier repo nuevo se cubre con un test que la invoque.

DB de test: Postgres local en Docker (`pg` clásico vía connection string `localhost`) con schema reset por suite. **No** se usa Neon en tests (lentitud + costo + flakiness de red en CI).

**Alternativa descartada**: `pglite` en-memory. Razón: la app va a usar features Postgres reales (jsonb, citext, generated columns) que pglite no soporta 100%; la divergencia entre test y prod es exactamente lo que estamos tratando de evitar.

## Impacto multi-tenant

Cómo se inyecta `organization_id` en cada query, paso por paso:

1. **Request entra** (Next.js route handler, server action, o webhook receiver): el middleware/action wrapper resuelve la sesión Better-Auth (cuando exista en `identity-tenancy`) y extrae `organizationId`.
2. **`runWithTenant(ctx, () => useCase())`**: AsyncLocalStorage guarda `ctx` para todo el árbol de await.
3. **Use case llama `new ContactRepository()`**: el constructor lee `getTenantContext()` y captura `orgId` como readonly.
4. **`contactRepo.findByPhone(phone)`** ejecuta `db.select().from(contacts).where(and(eq(contacts.phone, phone), eq(contacts.organizationId, this.orgId)))`. El filtro está aplicado por construcción del repo, no por elección del caller.
5. **Inserts**: `contactRepo.create({ phone, name })` — el tipo `InsertableContact` excluye `organizationId`; el repo lo agrega antes del INSERT.
6. **Test de aislamiento**: para cada repo nuevo, `assertTenantIsolation(() => new ContactRepository())` corre en CI. Si pasa con leak, falla el build.

Webhooks entrantes y jobs background (futuros) entran al árbol vía `runWithTenant` también — la regla es "ningún punto de entrada salta este wrapping".

## Risks / Trade-offs

- **R-D1**: AsyncLocalStorage tiene un costo de performance (~µs por await). → Aceptable: la alternativa explícita es peor en mantenibilidad y la app no es latency-critical (UI con < 200ms target).
- **R-D2**: el repo cerrado puede frustrar consultas analíticas legítimas (joins complejos para reportes). → Mitigación: una vez aparezca la capability `analytics`, se evalúa una capa `read-models` con lectura cross-org explícita y firmada por `SuperAdmin` only; nunca acceso libre.
- **R-D3**: AES-GCM con key única en env = pérdida de la key = pérdida de todas las credenciales BYO. → Mitigación: backup cifrado de la key fuera del repo, plan de recuperación documentado en `identity-tenancy` change. Para MVP se acepta.
- **R-D4**: Postgres en Docker para tests requiere Docker en la máquina dev y en CI. → Mitigación: GitHub Actions tiene servicio `postgres` nativo; localmente, `docker compose up -d` documentado en README.
- **R-D5**: ESLint boundaries puede dar falsos positivos en imports de tipos (`type` imports cross-layer). → Mitigación: regla excepción `import type` permitida hacia tipos de domain desde cualquier capa.
- **R-D6**: Cambio de driver Neon HTTP ↔ serverless tiene API ligeramente distinta (transacciones). → Mitigación: el `BaseRepository` solo usa la API común; transacciones se exponen vía un helper `withTransaction(fn)` que internamente usa `dbTx`.

## Migration Plan

No aplica una "migración" en el sentido de datos preexistentes — el repo está vacío de dominio. La secuencia de implementación está en `tasks.md`. Lo que sí queda registrado:

- La primera migración de Drizzle (`0000_initial.sql`) será generada por `identity-tenancy` change, no por este. Este change deja `drizzle-kit` configurado pero sin schemas todavía.
- La key `ENCRYPTION_KEY_V1` debe existir en `.env.local`, en CI secrets, y en producción ANTES de que cualquier columna cifrada se cree. Se documenta en `infrastructure/env/README.md` y se valida en boot por D6.

## Open Questions

- **Q1**: ¿La utilidad de tests de aislamiento debe vivir en `src/test/` o en un paquete separado consumido como devDep? — Resuelto: en `src/test/` por simplicidad, hasta que aparezca un segundo proyecto consumidor.
- **Q2**: ¿`drizzle-kit migrate` se corre en startup de la app, o como step explícito de CI/deploy? — Pendiente: decidir junto con el adapter de despliegue. Por ahora, comando manual `pnpm db:migrate`. La validación T3 con context7 confirma que Drizzle expone ambos modos.
- **Q3**: ¿Qué versión exacta de Postgres en Docker para tests? — Sugerido: `postgres:16-alpine` para alinear con Neon (que corre Postgres 16). Confirmar en tasks.md.
- **Q4**: ¿`citext` para email/phone case-insensitive desde el día 1, o esperar a la primera tabla que lo necesite? — Diferido: se decide en `identity-tenancy` (User.email) y `contacts` (Contact.phone normalizado E.164 ya es case-insensitive por construcción).

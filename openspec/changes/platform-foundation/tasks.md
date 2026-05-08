## 1. Dependencias y scripts

- [x] 1.1 Agregar dependencias runtime a `package.json`: `drizzle-orm`, `@neondatabase/serverless`, `zod`
- [x] 1.2 Agregar dev dependencies: `drizzle-kit`, `vitest`, `@vitest/coverage-v8`, `eslint-plugin-boundaries`, `tsx`, `@types/node`
- [x] 1.3 Definir scripts en `package.json`: `db:generate`, `db:migrate`, `db:studio`, `test`, `test:watch`, `typecheck`, `lint`, `lint:fix` (adaptado a npm en vez de pnpm)
- [x] 1.4 Verificar que `npm install` corre limpio y `npm run typecheck` pasa con scaffold actual
- [x] 1.5 Agregar `.env.example` con variables documentadas: `DATABASE_URL`, `ENCRYPTION_KEY_V1`, `NODE_ENV` (creado por el usuario manualmente)
- [x] 1.6 Generar key de ejemplo con `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` y documentar el comando en `.env.example`

## 2. Estructura hexagonal y boundaries

- [x] 2.1 Crear directorios vacíos: `src/domain/`, `src/application/`, `src/infrastructure/`, `src/test/` (con `.gitkeep` o un `index.ts` placeholder por carpeta)
- [x] 2.2 Configurar `eslint-plugin-boundaries` en `eslint.config.mjs` con elementos para cada capa según D2 del design
- [x] 2.3 Definir reglas `boundaries/element-types`: `domain` solo importa `domain`; `application` importa `domain`; `infrastructure` importa `domain` y `application`; `app` importa todo
- [x] 2.4 Permitir explícitamente `import type` desde `domain/**` hacia cualquier capa
- [x] 2.5 Agregar test manual de regresión: crear archivo dummy en `domain/` que importe de `application/`, verificar que `npm run lint` falla, eliminarlo

## 3. Env validation (Zod)

- [x] 3.1 Crear `src/infrastructure/env/env.ts` con schema Zod para `DATABASE_URL`, `ENCRYPTION_KEY_V1`, `NODE_ENV` (schema separado en `schema.ts` para tests)
- [x] 3.2 Validar que `ENCRYPTION_KEY_V1` decodea base64 a exactamente 32 bytes (`refine` con `Buffer.from(v, "base64").length === 32`)
- [x] 3.3 Exportar `env` parseado en module-load — fallar boot con mensaje legible si falta o es inválido
- [x] 3.4 Test unitario: `env.test.ts` con casos missing var, invalid format, happy path (mockear `process.env`)

## 4. Encryption helper (AES-256-GCM versionado)

- [x] 4.1 Crear `src/infrastructure/crypto/encryption.ts` con `encrypt(plaintext: string): Encrypted` usando AES-256-GCM y key `ENCRYPTION_KEY_V1`
- [x] 4.2 Formato del output: `v1:<iv-base64>:<ciphertext-base64>:<auth-tag-base64>`
- [x] 4.3 Implementar `decrypt(value: Encrypted): string` con dispatch por versión; lanzar error explícito si la versión es desconocida
- [x] 4.4 Definir el tipo `Encrypted = \`v${number}:${string}\`` y exportarlo
- [x] 4.5 Tests `encryption.test.ts`: round-trip, output matchea regex `^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$`, plaintext NO aparece en el ciphertext, tamper detection (modificar 1 byte → throw)
- [x] 4.6 Test de versión desconocida: `decrypt("v99:...")` lanza con mensaje claro

## 5. Tenant context (AsyncLocalStorage)

- [x] 5.1 Crear `src/infrastructure/tenant/context.ts` con tipo `TenantContext = { organizationId: string; userId: string; isSuperAdmin: boolean }`
- [x] 5.2 Exportar `runWithTenant<T>(ctx: TenantContext, fn: () => T): T` envolviendo `AsyncLocalStorage.run`
- [x] 5.3 Exportar `getTenantContext(): TenantContext` que lanza `Error("TenantContext not initialized — orphan request")` si no hay store
- [x] 5.4 Exportar `tryGetTenantContext(): TenantContext | undefined` para casos opcionales (ej. logging cross-cutting)
- [x] 5.5 Tests `context.test.ts`: get fuera de run → throws; get dentro de run → returna ctx; nested runs → ctx interno toma precedencia; async boundary preserva ctx (probar con `setTimeout` y `Promise.resolve()`)

## 6. DB client y drizzle-kit

- [x] 6.1 Crear `src/infrastructure/db/client.ts` con `db` (driver `neon-http` via `drizzle-orm/neon-http`) y `dbTx` lazy (driver `neon-serverless` via `drizzle-orm/neon-serverless`)
- [x] 6.2 Limitar la visibilidad: NO exportar `db`/`dbTx` desde `index.ts` de `infrastructure/db/` — solo accesibles desde `infrastructure/db/repositories/**` (no se creó `index.ts` — convención + grep manual en T11.5)
- [x] 6.3 Crear `drizzle.config.ts` en raíz apuntando a `src/infrastructure/db/schema/**` y `src/infrastructure/db/migrations/`
- [x] 6.4 Crear directorios `src/infrastructure/db/schema/` y `src/infrastructure/db/migrations/` con `.gitkeep`
- [x] 6.5 Verificar que `npm run db:generate` no falla con schema vacío (genera 0 migrations) y que `npm run db:studio` arranca (`db:generate` ✅ "0 tables, nothing to migrate"; `db:studio` carga config OK pero requiere `DATABASE_URL` real — se valida una vez Docker Postgres esté arriba en T8.2)

## 7. BaseRepository

- [x] 7.1 Crear `src/infrastructure/db/repositories/base.ts` con clase abstracta `BaseRepository<TTable extends { organizationId }>`
- [x] 7.2 Constructor toma `ctx?: TenantContext` (default `getTenantContext()`); captura `this.orgId` readonly
- [x] 7.3 Método protegido `scopedWhere()` retorna `eq(this.table.organizationId, this.orgId)`
- [x] 7.4 Método protegido `withOrgId<T>(input: T): T & { organizationId: string }` para inyección automática en inserts
- [x] 7.5 Helper `withTransaction(fn)` que usa `dbTx`, valida tenant context activo, propaga errores con rollback
- [x] 7.6 Test estructural `base.test.ts` (sin DB): instanciar `BaseRepository` fuera de `runWithTenant` → throws; dentro de `runWithTenant("org_A", ...)` → captura `org_A`

## 8. Test infrastructure y assertTenantIsolation

- [x] 8.1 Configurar `vitest.config.ts` con setup file, alias `@/` apuntando a `src/`, coverage config
- [x] 8.2 Crear `docker-compose.test.yml` con servicio `postgres:16-alpine` para tests de integración locales
- [x] 8.3 Documentar en `README.md` cómo levantar la DB de test: `docker compose -f docker-compose.test.yml up -d`
- [x] 8.4 Crear `src/test/db.ts` con setup/teardown de schema para tests de integración (drop + create + migrate antes de cada suite)
- [x] 8.5 Crear `src/test/factories.ts` con helpers `makeTenantContext(orgId, opts?)` y `withFreshTenants(fn)` que setea dos orgs aisladas
- [x] 8.6 Crear `src/test/assertTenantIsolation.ts` con la helper firma `assertTenantIsolation<T>(repoFactory: (ctx) => Repository<T>, sample: InsertableT)`: siembra fila en org_A, intenta leer en org_B, falla si encuentra algo
- [x] 8.7 Test smoke `assertTenantIsolation.test.ts` con un repo dummy correcto (pasa) y un repo dummy roto que omite filtro (helper detecta y lanza con mensaje "Tenant isolation breach: org_B saw N row(s) belonging to org_A")

## 9. CI pipeline

- [x] 9.1 Crear `.github/workflows/ci.yml` con jobs `lint`, `typecheck`, `test` corriendo en `ubuntu-latest`
- [x] 9.2 Agregar servicio `postgres:16-alpine` al job `test` con healthcheck y env `POSTGRES_PASSWORD=test`
- [x] 9.3 Cachear `pnpm store` y `node_modules` con `actions/setup-node@v4` + `cache: pnpm` (adaptado a npm: `cache: npm` + `cache-dependency-path: src/package-lock.json`)
- [x] 9.4 Configurar `pnpm install --frozen-lockfile` en cada job (adaptado: `npm ci`)
- [x] 9.5 Setear secret `DATABASE_URL` (test DB) y `ENCRYPTION_KEY_V1` (random fixture) en el job de test vía `env`
- [ ] 9.6 Marcar los 3 jobs como required checks en branch protection de `main` *(BLOQUEADO: el repo no tiene remote en GitHub todavía. Acción del usuario: crear repo + push + branch protection rule)*
- [ ] 9.7 Verificar que un PR de prueba con `npm run lint` rojo bloquea merge (smoke test del pipeline) *(BLOQUEADO: requiere repo en GitHub + PR con error intencional. Acción del usuario)*

## 10. Documentación interna

- [x] 10.1 Actualizar `src/AGENTS.md` con las reglas de oro de la capa: NUNCA instanciar repo sin `TenantContext`, NUNCA persistir credenciales BYO sin pasar por `encrypt()`, NUNCA exportar `db`/`dbTx` fuera de `infrastructure/db/repositories/**`
- [x] 10.2 Documentar en `src/AGENTS.md` el flujo de creación de un repositorio nuevo (extender `BaseRepository`, agregar test que llame `assertTenantIsolation`)
- [x] 10.3 Actualizar `README.md` con sección "Setup local": Docker Postgres, env vars, `npm run db:migrate`, `npm run dev`, `npm run test` (hecho en sección 8 con T8.3)
- [x] 10.4 Documentar en `README.md` cómo rotar la encryption key: subir `ENCRYPTION_KEY_V2`, los nuevos `encrypt` usan v2, los `v1` viejos se siguen leyendo

## 11. Verificación end-to-end

- [x] 11.1 Correr `npm install`, `npm run lint`, `npm run typecheck`, `npm run test` localmente — todos en verde
- [x] 11.2 Correr `npm run db:generate` y `npm run db:migrate` contra la DB local de Docker — exit 0 (auto-detect driver agregado en `migrate.ts`)
- [x] 11.3 Validar el change con `openspec validate platform-foundation` — output "Change is valid"
- [ ] 11.4 Crear PR de prueba; verificar que CI corre los 3 jobs y todos pasan *(BLOQUEADO: requiere repo en GitHub)*
- [x] 11.5 Revisar manualmente que `git grep -E 'from.*db/client' src/` solo encuentra archivos en `src/infrastructure/db/repositories/**` (único hit: `infrastructure/db/repositories/base.ts`)
- [ ] 11.6 Commit final con mensaje conventional `feat(platform): bootstrap multi-tenant foundation` *(pendiente: confirmar con el usuario antes de commitear)*

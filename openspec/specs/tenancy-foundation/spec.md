# tenancy-foundation Specification

## Purpose

Establece las garantías de aislamiento multi-tenant, BYO credentials cifradas, fronteras hexagonales, y el toolchain de plataforma (migrations, env validation, CI gates) que sostienen toda la aplicación. Esta capability es la base sobre la que descansan el resto de capabilities del producto: ningún dato de dominio puede leerse o escribirse sin un `TenantContext` activo, ningún secreto de cliente puede persistirse en plaintext, y ninguna violación de capa puede llegar a `main`.

## Requirements

### Requirement: Tenant context required for all data access

Toda lectura o escritura sobre tablas de dominio SHALL ejecutarse dentro de un `TenantContext` activo. La ausencia de contexto al instanciar un repositorio o invocar una función de dominio que toque persistencia SHALL lanzar un error en runtime, NUNCA degradar a una query sin filtro.

#### Scenario: Repository instantiation without tenant context

- **WHEN** se instancia una clase que extiende `BaseRepository` fuera de un wrapper `runWithTenant(...)`
- **THEN** el constructor lanza un error con el mensaje "TenantContext not initialized — orphan request"

#### Scenario: Tenant context provides organization id to constructor

- **WHEN** una request entra y el wrapper invoca `runWithTenant({ organizationId: "org_A", userId: "u1", isSuperAdmin: false }, () => new ContactRepository())`
- **THEN** el repositorio captura `org_A` como su `orgId` y lo usa para todas las queries posteriores en ese árbol async

### Requirement: Repository auto-injects organization_id on reads

Toda query de lectura emitida por un repositorio que extiende `BaseRepository` SHALL incluir el predicado `organization_id = <ctx.organizationId>` en su cláusula WHERE, aplicado por construcción del repositorio y no por elección del caller.

#### Scenario: SELECT compone scopedWhere automáticamente

- **WHEN** un `ContactRepository` instanciado bajo `org_A` ejecuta `findByPhone("+573001234567")`
- **THEN** la query SQL emitida contiene `WHERE phone = '+573001234567' AND organization_id = 'org_A'`

#### Scenario: Lectura cross-org devuelve vacío

- **WHEN** existe una fila con `organization_id = 'org_B'` y se consulta desde un repositorio instanciado bajo `org_A`
- **THEN** la query devuelve un set vacío y NO se observa la fila de `org_B`

### Requirement: Repository auto-injects organization_id on writes

Toda operación de inserción emitida por un repositorio SHALL setear `organization_id` desde el `TenantContext` activo, ignorando cualquier valor que el caller intente proveer para esa columna. Los tipos `InsertableX` expuestos por los repositorios SHALL excluir `organizationId` del shape recibido.

#### Scenario: INSERT setea organization_id desde contexto

- **WHEN** un `ContactRepository` bajo `org_A` ejecuta `create({ phone: "+57...", name: "Ana" })`
- **THEN** la fila persistida tiene `organization_id = 'org_A'`

#### Scenario: Caller no puede falsificar organization_id

- **WHEN** TypeScript compila un caller que intenta `repo.create({ phone: "+57...", name: "Ana", organizationId: "org_B" })`
- **THEN** la compilación falla con un error de tipo (la propiedad `organizationId` no existe en `InsertableContact`)

### Requirement: Closed repository API — no raw db client exposure

El cliente Drizzle (`db`, `dbTx`) SHALL ser un detalle interno de `infrastructure/db/repositories/**`. NO SHALL ser re-exportado, importado, ni accesible desde `domain/**`, `application/**`, `app/**`, ni desde otros directorios de `infrastructure/**` que no sean repositories. Esta regla SHALL ser enforced por una regla de ESLint que bloquee CI ante violación.

#### Scenario: Import del cliente db desde application falla en lint

- **WHEN** un archivo en `src/application/` intenta `import { db } from "@/infrastructure/db/client"`
- **THEN** ESLint reporta error `boundaries/no-private` y `npm lint` retorna exit code distinto de 0

#### Scenario: BaseRepository no expone el cliente

- **WHEN** se inspecciona la API pública de `BaseRepository`
- **THEN** no existe método público que devuelva la instancia del cliente Drizzle ni un `QueryBuilder` no-scopeado

### Requirement: BYO credentials encrypted at rest

Toda columna marcada como credencial BYO (tokens Cloud API del cliente, sesiones WAHA, API keys de OpenRouter del cliente) SHALL ser persistida exclusivamente a través del helper `encrypt()` de `infrastructure/crypto/encryption.ts`. El valor en la base de datos NUNCA SHALL ser texto plano.

#### Scenario: Encrypt produce ciphertext con version prefix

- **WHEN** se invoca `encrypt("secret-token-123")`
- **THEN** el valor retornado matchea el patrón `^v[0-9]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$` y NO contiene la cadena `secret-token-123`

#### Scenario: Decrypt round-trip recupera plaintext

- **WHEN** se invoca `decrypt(encrypt("secret-token-123"))`
- **THEN** el resultado es exactamente `"secret-token-123"`

#### Scenario: Decrypt falla con tampered ciphertext

- **WHEN** se modifica un byte del campo de ciphertext o tag y se invoca `decrypt(...)` con el valor alterado
- **THEN** la función lanza un error de autenticación AES-GCM y NO retorna texto plano

### Requirement: Encryption key versioning

Los valores cifrados SHALL llevar un prefijo de versión (`v1:`, `v2:`, etc.) que identifica la key usada. La función `decrypt` SHALL despachar por versión, permitiendo que coexistan filas cifradas con keys distintas durante una rotación.

#### Scenario: Decrypt despacha por versión

- **WHEN** existe una fila cifrada con prefijo `v1:` y otra con prefijo `v2:`, y ambas keys están configuradas en env
- **THEN** `decrypt` retorna el plaintext correcto para cada una

#### Scenario: Decrypt con versión desconocida lanza error

- **WHEN** se invoca `decrypt("v99:...")` y la key `ENCRYPTION_KEY_V99` no está configurada
- **THEN** la función lanza un error con mensaje "Unknown encryption key version: 99"

### Requirement: Environment validated at boot

Las variables de entorno requeridas SHALL ser validadas con un schema Zod al cargar el módulo `infrastructure/env/env.ts`. Si una variable obligatoria falta o tiene formato inválido, la aplicación SHALL fallar el arranque con un mensaje que liste las variables problemáticas.

#### Scenario: Missing DATABASE_URL impide boot

- **WHEN** se inicia la aplicación sin `DATABASE_URL` en el ambiente
- **THEN** el proceso termina con exit code distinto de 0 y stderr contiene "DATABASE_URL: Required"

#### Scenario: ENCRYPTION_KEY_V1 con longitud inválida impide boot

- **WHEN** `ENCRYPTION_KEY_V1` está presente pero su decode base64 no resulta en exactamente 32 bytes
- **THEN** el proceso termina con error "ENCRYPTION_KEY_V1 must decode to 32 bytes"

### Requirement: Hexagonal layer boundaries enforced

Los imports entre directorios de `src/` SHALL respetar la dirección hexagonal. Las violaciones SHALL bloquear CI vía ESLint, no ser reportadas como warning.

| Capa origen | Puede importar de |
|-------------|-------------------|
| `domain/**` | (solo `domain/**` y stdlib) |
| `application/**` | `domain/**` |
| `infrastructure/**` | `domain/**`, `application/**` |
| `app/**` | `domain/**`, `application/**`, `infrastructure/**`, `components/**`, `lib/**` |

`import type` desde `domain/**` SHALL ser permitido desde cualquier capa.

#### Scenario: Domain importa application falla CI

- **WHEN** un archivo en `src/domain/` agrega `import { someUseCase } from "@/application/contacts/someUseCase"` y se ejecuta `npm lint`
- **THEN** ESLint reporta error y `npm lint` retorna exit code distinto de 0

#### Scenario: Application importa infrastructure falla CI

- **WHEN** un archivo en `src/application/` agrega `import { ContactRepository } from "@/infrastructure/db/repositories/contactRepository"` y se ejecuta `npm lint`
- **THEN** ESLint reporta error de boundary; el repositorio debe inyectarse vía port

#### Scenario: Type-only import desde domain está permitido

- **WHEN** un archivo en `src/infrastructure/` agrega `import type { Contact } from "@/domain/contacts/contact"`
- **THEN** ESLint no reporta error

### Requirement: Tenant isolation test utility

El paquete de test SHALL exponer una helper `assertTenantIsolation(repoFactory, sampleData)` que valida automáticamente que un repositorio no filtra datos cross-organization. Todo repositorio nuevo SHALL incluir un test que la invoque, y este test SHALL ejecutarse en CI.

#### Scenario: assertTenantIsolation pasa con repo correcto

- **WHEN** se invoca `assertTenantIsolation` con un `ContactRepository` correctamente implementado, sembrando una fila bajo `org_A` y consultando bajo `org_B`
- **THEN** la helper completa sin error y la consulta bajo `org_B` retorna vacío

#### Scenario: assertTenantIsolation detecta leak

- **WHEN** se invoca `assertTenantIsolation` con un repositorio mal implementado que omite el filtro `organization_id`, y la consulta bajo `org_B` retorna datos de `org_A`
- **THEN** la helper lanza un assertion error con mensaje "Tenant isolation breach: org_B saw <N> row(s) belonging to org_A"

### Requirement: Migrations toolchain configured

`drizzle-kit` SHALL estar configurado con un archivo `drizzle.config.ts` apuntando a `infrastructure/db/schema/**` como source y a `infrastructure/db/migrations/` como output. Los comandos `npm db:generate` y `npm db:migrate` SHALL operar sobre Neon Postgres usando `DATABASE_URL` validado en boot.

#### Scenario: drizzle-kit generate produce migration desde schema

- **WHEN** existe un archivo de schema en `src/infrastructure/db/schema/` y se ejecuta `npm db:generate`
- **THEN** se crea un archivo `.sql` en `src/infrastructure/db/migrations/` con el DDL correspondiente

#### Scenario: npm db:migrate aplica pending migrations

- **WHEN** existen migrations sin aplicar y se ejecuta `npm db:migrate` apuntando a una DB Postgres válida
- **THEN** las migrations se aplican y la tabla `__drizzle_migrations` registra los hashes correspondientes

### Requirement: CI gates lint, typecheck, and test

El pipeline de CI SHALL ejecutar `npm lint`, `npm typecheck` y `npm test` en cada pull request. Cualquier exit code distinto de 0 SHALL bloquear el merge. CI verde SHALL ser requisito no negociable para mergear a `main`.

#### Scenario: Lint rojo bloquea merge

- **WHEN** un PR contiene un archivo que viola las reglas de ESLint
- **THEN** el job de CI "lint" falla y el PR queda con check "Required" en rojo, impidiendo merge

#### Scenario: Typecheck rojo bloquea merge

- **WHEN** un PR contiene un archivo TypeScript con error de tipo
- **THEN** el job de CI "typecheck" falla con la salida de `tsc --noEmit` y el PR no puede mergearse

#### Scenario: Test rojo bloquea merge

- **WHEN** un PR contiene un test que falla, incluyendo un test de aislamiento multi-tenant
- **THEN** el job de CI "test" falla con la salida de Vitest y el PR no puede mergearse

### Requirement: Repository transaction helper

El módulo de infraestructura SHALL exponer una función `withTransaction(fn)` que ejecuta `fn` dentro de una transacción Postgres usando el cliente `dbTx` (driver `neon-serverless`). El `TenantContext` activo SHALL persistir dentro del callback transaccional.

#### Scenario: Operaciones dentro de transacción ven el mismo tenant context

- **WHEN** se invoca `runWithTenant(ctxA, () => withTransaction(async () => { repoA.create(...); repoB.create(...); }))`
- **THEN** ambas inserciones ocurren atómicamente, ambas con `organization_id = ctxA.organizationId`, y un error en cualquiera de las dos hace rollback de ambas

#### Scenario: Transacción sin tenant context lanza error

- **WHEN** se invoca `withTransaction(...)` fuera de un `runWithTenant`
- **THEN** el wrapper lanza el mismo error "TenantContext not initialized — orphan request" antes de abrir la transacción

## ADDED Requirements

### Requirement: Catálogo de planes configurable

El sistema SHALL mantener un catálogo de planes persistido y editable sin redeploy. Cada plan MUST tener una clave única (`trial`, `basic`, `plus`, `pro`), un nombre, un precio en USD y un conjunto de límites por entitlement key. El catálogo MUST poder ampliarse con nuevos límites sin cambiar el esquema de columnas. Los precios de overage y de unidades adicionales MUST poder almacenarse como dato aunque NO se cobren en esta versión.

#### Scenario: Catálogo inicial sembrado
- **WHEN** se ejecuta el seed del catálogo
- **THEN** el sistema crea los planes Trial, Basic, Plus y Pro con sus límites en USD (mensajes incluidos, números, usuarios, automatizaciones activas, agentes activos, features booleanas e ilimitados)
- **AND** el seed es idempotente: re-ejecutarlo no duplica planes ni límites

#### Scenario: Edición de un límite del plan
- **WHEN** un operador modifica el límite de un entitlement de un plan en la persistencia
- **THEN** las autorizaciones posteriores de organizaciones en ese plan usan el nuevo límite sin requerir redeploy

#### Scenario: Nuevo entitlement key sin migración de columnas
- **WHEN** se introduce un nuevo entitlement key para una feature futura
- **THEN** el sistema permite asignarle un valor por plan sin alterar el esquema de columnas existentes

### Requirement: Asignación de plan por organización

El sistema SHALL asociar a cada organización exactamente un plan activo mediante una suscripción. Toda organización recién creada MUST quedar asignada al plan Trial automáticamente. La suscripción MUST exponer un estado (`trialing`, `active`, ...) y MUST estar modelada para soportar, sin migración disruptiva, el ciclo de facturación y la referencia de la pasarela que añadirá el engine de cobro.

#### Scenario: Org nueva nace en Trial
- **WHEN** se crea una organización
- **THEN** el sistema crea su suscripción asignada al plan Trial en estado de prueba
- **AND** la organización tiene exactamente un plan activo

#### Scenario: Backfill de organizaciones existentes
- **WHEN** se aplica el cambio sobre organizaciones que aún no tienen suscripción
- **THEN** el sistema les crea una suscripción Trial para garantizar que toda organización tenga un plan del cual resolver límites

#### Scenario: Resolución del plan de una organización
- **WHEN** un servicio solicita el plan vigente de una organización
- **THEN** el sistema devuelve el plan de su suscripción activa como fuente única de verdad, ignorando cualquier otra señal (p. ej. metadata de sesión)

### Requirement: Override de límites por organización y resolución de límite efectivo

El sistema SHALL permitir definir, por organización, un override de valor para un entitlement key que prevalezca sobre el valor del plan. El **límite efectivo** de un entitlement para una organización MUST resolverse como `override(org, key)` si existe, en caso contrario el valor del plan. Esta resolución MUST ser la única vía por la que el enforcement obtiene un límite.

#### Scenario: Override prevalece sobre el plan
- **WHEN** una organización en plan Basic tiene un override de `whatsapp_numbers` mayor que el del plan
- **THEN** el límite efectivo de `whatsapp_numbers` para esa organización es el del override, no el del plan

#### Scenario: Sin override se usa el plan
- **WHEN** una organización no tiene override para un entitlement key
- **THEN** el límite efectivo es el valor de ese entitlement en su plan

#### Scenario: Limpieza de override
- **WHEN** se elimina el override de un entitlement de una organización
- **THEN** el límite efectivo vuelve a ser el del plan en las autorizaciones posteriores

### Requirement: Contrato de autorización de entitlements y enforcement de topes duros

El sistema SHALL exponer un `EntitlementsPort` consumible por las features a través del `ctx`, con una operación de autorización `authorize(ctx, { key, current?, delta })` que devuelve una decisión `{ allowed: true }` o `{ allowed: false, reason, key, limit, current }`. Para entitlements de tipo tope por conteo, la **feature MUST aportar el conteo actual** (`current`) y el billing MUST ser dueño del límite; el sistema NO MUST consultar el esquema de datos de la feature. El sistema SHALL aplicar enforcement de topes duros en esta versión; cuando una operación excede el límite efectivo, el servicio MUST denegarla mediante un `DomainError` que incluya `key`, `limit` y `current`. El contrato MUST distinguir los tipos de entitlement: cupo medido, tope por conteo, booleano, ilimitado y metadata.

#### Scenario: Autorización dentro del límite
- **WHEN** una feature solicita `authorize` para `whatsapp_numbers` con `current=1`, `delta=+1` y el límite efectivo es 2
- **THEN** la decisión es `allowed: true`

#### Scenario: Autorización que excede un tope duro
- **WHEN** una feature solicita `authorize` para `active_automations` con `current=5`, `delta=+1` y el límite efectivo es 5
- **THEN** la decisión es `allowed: false` con `reason`, `key`, `limit=5` y `current=5`
- **AND** el adaptador de servicio traduce la denegación a un `DomainError` (forbidden/conflict)

#### Scenario: Entitlement booleano deshabilitado por plan
- **WHEN** una feature consulta un entitlement booleano (p. ej. `mass_campaigns`) y el plan efectivo lo tiene en falso
- **THEN** la decisión es `allowed: false`

#### Scenario: Entitlement ilimitado
- **WHEN** una feature solicita `authorize` para un entitlement marcado como ilimitado (p. ej. `contacts`)
- **THEN** la decisión es `allowed: true` independientemente de `current`

#### Scenario: La capa de servicios permanece pura
- **WHEN** se inspeccionan los módulos de `lib/services/billing/`
- **THEN** ninguno importa `next/*`, `hono`, `@hono/*` ni `web/app/**`, y reciben dependencias (db, org, usuario) por `ctx`

### Requirement: Contrato de registro de uso

El sistema SHALL definir un `UsagePort` con una operación `record(ctx, metric, qty)` y una estructura de persistencia para eventos de uso (ledger), de modo que la feature de envío de mensajes pueda registrarlos en un cambio posterior. En esta versión el registro de uso NO MUST afectar el enforcement de cupos medidos (overage de mensajes), que se difiere al engine de cobro.

#### Scenario: Interfaz disponible para features futuras
- **WHEN** una feature obtiene el `ctx`
- **THEN** dispone del `UsagePort` para registrar uso, aunque el adaptador de esta versión no calcule overage ni cobre

#### Scenario: El cupo medido no bloquea en v0
- **WHEN** una organización supera su cantidad de mensajes incluidos en esta versión
- **THEN** el sistema NO MUST bloquear por overage ni generar cobro (comportamiento diferido al engine de cobro)

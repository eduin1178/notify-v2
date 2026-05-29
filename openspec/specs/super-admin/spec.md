## Purpose

Define el rol global de plataforma de Notify (SuperAdmin) y el panel `/super-admin` para operadores del SaaS. SuperAdmin existe a nivel usuario, independiente de las membresías de organización: un SuperAdmin puede no pertenecer a ninguna org. El rol solo se otorga mediante la variable de entorno `SUPER_ADMIN_EMAIL` (no por UI) y permite inspeccionar todas las orgs y usuarios, además de suspender/reactivar cuentas a nivel plataforma.
## Requirements
### Requirement: Rol global de SuperAdmin separado del modelo de organización

El sistema SHALL modelar SuperAdmin como un atributo del usuario a nivel plataforma, independiente de las memberships de organización. Un SuperAdmin MUST poder existir sin pertenecer a ninguna organización.

#### Scenario: SuperAdmin sin memberships accede al panel
- **WHEN** un usuario con rol SuperAdmin y sin membership en ninguna organización inicia sesión
- **THEN** el sistema MUST permitirle el acceso a `/super-admin` sin forzar onboarding de organización

#### Scenario: SuperAdmin con memberships
- **WHEN** un usuario con rol SuperAdmin y memberships activas inicia sesión
- **THEN** el sistema MUST exponer tanto la vista normal de organización como el acceso a `/super-admin`

### Requirement: Panel de administración de plataforma

El sistema SHALL exponer una ruta `/super-admin` accesible exclusivamente para usuarios con rol SuperAdmin. La ruta MUST listar todas las organizaciones y todos los usuarios de la plataforma con capacidad de inspección. El panel MUST renderizarse dentro del shell unificado `(app)/` usando el `AppSidebar` en `mode="super-admin"`; NO MUST tener un header propio inline ni un menú de usuario separado.

#### Scenario: Acceso autorizado al panel
- **WHEN** un SuperAdmin navega a `/super-admin`
- **THEN** el sistema renderiza el panel dentro del shell `(app)/` con `AppSidebar` en modo super-admin
- **AND** el sidebar muestra las entradas "Organizaciones" y "Usuarios"
- **AND** el sidebar ofrece "Volver a la app" que navega a `/post-auth`

#### Scenario: Acceso no autorizado al panel
- **WHEN** un usuario que no es SuperAdmin navega a `/super-admin`
- **THEN** el sistema MUST responder con 404 o 403 sin revelar la existencia del panel y NO MUST exponer datos de plataforma

#### Scenario: Acceso sin sesión
- **WHEN** un visitante sin sesión navega a `/super-admin`
- **THEN** el sistema lo redirige a `/sign-in`

#### Scenario: La URL pública no cambia
- **WHEN** se accede al panel desde cualquier enlace o redirect
- **THEN** la URL pública sigue siendo `/super-admin` (el route group `(app)` no afecta el path)

### Requirement: Suspensión de usuarios desde el panel

El sistema SHALL permitir a un SuperAdmin suspender o reactivar a cualquier usuario de la plataforma. Un usuario suspendido MUST quedar imposibilitado de iniciar sesión hasta su reactivación.

#### Scenario: Suspender a un usuario activo
- **WHEN** un SuperAdmin suspende a un usuario desde el panel
- **THEN** el sistema marca al usuario como suspendido, invalida sus sesiones activas y bloquea futuros inicios de sesión hasta que se reactive

#### Scenario: Usuario suspendido intenta iniciar sesión
- **WHEN** un usuario suspendido completa OAuth en Google o GitHub
- **THEN** el sistema MUST rechazar el establecimiento de sesión y mostrar un mensaje neutro indicando que el acceso está deshabilitado

#### Scenario: Reactivación de un usuario
- **WHEN** un SuperAdmin reactiva a un usuario previamente suspendido
- **THEN** el sistema desmarca la suspensión y el usuario puede iniciar sesión nuevamente

### Requirement: El bootstrap del SuperAdmin no puede deshabilitarse desde la UI

El sistema NO MUST exponer en ninguna UI la capacidad de otorgar o revocar el rol SuperAdmin a un email arbitrario. El rol MUST gestionarse exclusivamente mediante la variable de entorno `SUPER_ADMIN_EMAIL` y la promoción automática en login.

#### Scenario: Intento de cambio de rol global desde el panel
- **WHEN** se inspecciona la UI de `/super-admin`
- **THEN** la UI NO MUST contener ningún control para promover o degradar a un usuario al rol SuperAdmin

### Requirement: Gestión de plan y overrides de límite por organización desde el panel

El sistema SHALL permitir a un SuperAdmin consultar y cambiar el plan de cualquier organización, y definir o limpiar overrides de límite por entitlement key para una organización. El cambio de plan MUST actualizar la suscripción de la organización (fuente única de verdad del plan). Esta capacidad MUST operar contra la capa de servicios `billing` y NO MUST exponer ningún flujo de cobro en esta versión.

#### Scenario: SuperAdmin consulta el plan de una organización
- **WHEN** un SuperAdmin abre la ficha de una organización en `/super-admin`
- **THEN** el sistema muestra el plan vigente de su suscripción y los límites efectivos por entitlement

#### Scenario: SuperAdmin cambia el plan de una organización
- **WHEN** un SuperAdmin asigna a una organización un plan distinto (p. ej. de Trial a Plus)
- **THEN** el sistema actualiza la suscripción de la organización al nuevo plan
- **AND** las autorizaciones posteriores de esa organización usan los límites del nuevo plan
- **AND** no se ejecuta ningún cobro

#### Scenario: SuperAdmin define un override de límite
- **WHEN** un SuperAdmin establece para una organización un override de un entitlement key (p. ej. `whatsapp_numbers`)
- **THEN** el límite efectivo de ese entitlement para la organización pasa a ser el del override, prevaleciendo sobre el plan

#### Scenario: SuperAdmin limpia un override de límite
- **WHEN** un SuperAdmin elimina el override de un entitlement de una organización
- **THEN** el límite efectivo de ese entitlement vuelve a resolverse desde el plan

#### Scenario: Acceso no autorizado a la gestión de planes
- **WHEN** un usuario que no es SuperAdmin intenta cambiar el plan u override de cualquier organización
- **THEN** el sistema MUST denegar la operación sin revelar la existencia de la capacidad


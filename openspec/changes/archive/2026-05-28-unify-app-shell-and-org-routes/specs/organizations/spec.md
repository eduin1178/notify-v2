## MODIFIED Requirements

### Requirement: Pertenencia múltiple

El sistema SHALL permitir que un mismo usuario pertenezca a múltiples organizaciones simultáneamente, con un rol independiente por organización. La sesión MUST exponer una única organización activa por vez. El cambio de organización activa MUST realizarse desde el componente `TeamSwitcher` del `AppSidebar`; NO MUST existir un `OrgSwitcher` separado en un topbar.

#### Scenario: Usuario pertenece a varias organizaciones

- **WHEN** un usuario tiene memberships en tres organizaciones
- **THEN** el `TeamSwitcher` del `AppSidebar` MUST listar las tres y el usuario puede cambiar la organización activa sin cerrar sesión

#### Scenario: Cambio de organización activa

- **WHEN** el usuario selecciona otra organización en el `TeamSwitcher`
- **THEN** el sistema actualiza la organización activa en la sesión (vía la server action existente de better-auth) y navega a `/org/{nuevoSlug}`

#### Scenario: Crear organización desde el switcher

- **WHEN** el usuario abre el dropdown del `TeamSwitcher` y activa "Crear organización"
- **THEN** el sistema navega a `/onboarding/new-org`

## ADDED Requirements

### Requirement: El segmento de URL de la organización es `/org/[orgSlug]`

El sistema SHALL servir todas las rutas de organización bajo el prefijo `/org/[orgSlug]`. El prefijo legado `/o/[orgSlug]` MUST NOT estar registrado en el árbol de rutas.

#### Scenario: Acceso al dashboard de organización

- **WHEN** un usuario autenticado con membership activa abre `/org/{slug}`
- **THEN** el sistema renderiza el dashboard de la organización dentro del shell `(app)/`

#### Scenario: Acceso a la vista de miembros

- **WHEN** un usuario con permisos abre `/org/{slug}/members`
- **THEN** el sistema renderiza la vista de miembros dentro del shell `(app)/`

#### Scenario: Acceso al prefijo legado `/o/`

- **WHEN** un usuario abre cualquier URL bajo `/o/{slug}/...`
- **THEN** el sistema responde con 404 (Next.js no resuelve el segmento, no existe ningún archivo bajo `app/(app)/o/`)

#### Scenario: Emisión de paths internos

- **WHEN** cualquier código del sistema (server actions, helpers, componentes) genera un path hacia el dashboard de una organización
- **THEN** el path emitido MUST comenzar con `/org/` y NO MUST comenzar con `/o/`

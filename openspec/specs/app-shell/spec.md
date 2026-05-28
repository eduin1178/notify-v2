## Purpose

Define el shell unificado de las áreas autenticadas de Notify. Todas las rutas autenticadas (organización y super-admin) viven bajo un único route group `(app)/` que aporta un shell común basado en `SidebarProvider`, `AppSidebar` y `SidebarInset`. El shell expone un único componente `AppSidebar` adaptativo (`mode: "org" | "super-admin"`) y un único punto de acceso al menú de usuario (`NavUser` en el `SidebarFooter`). El root `app/layout.tsx` no monta header de marketing dentro de áreas autenticadas.

## Requirements

### Requirement: Shell autenticado unificado bajo route group `(app)`

El sistema SHALL renderizar todas las áreas autenticadas (organización y super-admin) dentro de un mismo route group `(app)/` que aporta el shell común: `SidebarProvider`, `AppSidebar` y `SidebarInset`. El root `app/layout.tsx` MUST NOT montar ningún header de marketing.

#### Scenario: Usuario autenticado entra al dashboard de una organización

- **WHEN** un usuario con sesión válida abre `/org/{slug}` o cualquier subruta
- **THEN** la página se renderiza dentro del shell `(app)/` con `AppSidebar` a la izquierda y el contenido en `SidebarInset`
- **AND** la `Navbar` de marketing NO se renderiza en ningún lugar de la página

#### Scenario: SuperAdmin entra al panel de plataforma

- **WHEN** un usuario con rol SuperAdmin abre `/super-admin` o cualquier subruta
- **THEN** la página se renderiza dentro del mismo shell `(app)/` con `AppSidebar` en modo `super-admin`
- **AND** la `Navbar` de marketing NO se renderiza

#### Scenario: Visitante anónimo entra al área autenticada

- **WHEN** un visitante sin sesión abre `/org/{slug}` o `/super-admin`
- **THEN** el sistema lo redirige a `/sign-in` mediante los guards existentes y NO renderiza el shell

### Requirement: `AppSidebar` adaptativo según el modo

El sistema SHALL exponer un único componente `AppSidebar` que recibe un prop `mode: "org" | "super-admin"` y adapta su contenido visible. Las dos zonas autenticadas MUST usar el mismo componente; no se permite duplicar el sidebar.

#### Scenario: Modo organización

- **WHEN** `AppSidebar` se renderiza con `mode="org"`
- **THEN** el sidebar muestra `TeamSwitcher` en la parte superior con la organización activa y la lista de memberships del usuario
- **AND** muestra entradas de navegación específicas de la organización (al menos "Miembros")

#### Scenario: Modo super-admin

- **WHEN** `AppSidebar` se renderiza con `mode="super-admin"`
- **THEN** el sidebar NO muestra `TeamSwitcher` (oculto o reemplazado por un branding "Notify · Plataforma")
- **AND** muestra entradas de navegación de plataforma ("Organizaciones", "Usuarios")
- **AND** ofrece una entrada "Volver a la app" que regresa al área de organización vía `/post-auth`

#### Scenario: SuperAdmin que también es miembro de una organización

- **WHEN** un SuperAdmin está en `mode="org"`
- **THEN** el `AppSidebar` MUST ofrecer una entrada "Plataforma" que navega a `/super-admin`

### Requirement: `NavUser` en `SidebarFooter` como único acceso al menú de usuario

El sistema SHALL renderizar el componente `NavUser` (avatar + nombre + email + menú) en el `SidebarFooter` de `AppSidebar`. El menú MUST exponer la acción "Cerrar sesión" y MUST NOT existir otro topbar o header con un menú de usuario duplicado dentro del shell `(app)/`.

#### Scenario: Acceso al menú de usuario

- **WHEN** el shell autenticado se renderiza
- **THEN** el `SidebarFooter` muestra `NavUser` con el avatar del usuario, su nombre y su email
- **AND** al hacer clic se abre un dropdown con la opción "Cerrar sesión"

#### Scenario: Cerrar sesión desde el sidebar

- **WHEN** el usuario activa "Cerrar sesión" desde `NavUser`
- **THEN** el sistema invoca `signOut()` del cliente better-auth, invalida la sesión y redirige a `/`

#### Scenario: No hay otro menú de usuario en el shell

- **WHEN** se inspecciona cualquier página dentro de `(app)/`
- **THEN** existe exactamente un `NavUser` visible (el del `SidebarFooter`)
- **AND** NO existen los componentes `Topbar` ni `UserMenu` ni headers inline con menú de usuario

### Requirement: Layouts hijos preparan el shell y lo cablean con datos del contexto

El sistema SHALL resolver los datos necesarios para el shell (sesión, memberships, organización activa, items de navegación) en los layouts hijos `(app)/org/[orgSlug]/layout.tsx` y `(app)/super-admin/layout.tsx`, y pasarlos al componente de shell. El layout raíz del grupo `(app)/layout.tsx` MUST limitarse a garantizar sesión.

#### Scenario: Layout de organización resuelve memberships

- **WHEN** se carga `/org/{slug}/...`
- **THEN** `(app)/org/[orgSlug]/layout.tsx` invoca `loadOrgContext(slug)` y obtiene las memberships del usuario
- **AND** pasa al shell `mode="org"`, la organización activa, las memberships y los items de navegación de organización

#### Scenario: Layout de super-admin resuelve el guard

- **WHEN** se carga `/super-admin/...`
- **THEN** `(app)/super-admin/layout.tsx` invoca `requireSuperAdmin()`
- **AND** pasa al shell `mode="super-admin"` y los items de navegación de plataforma

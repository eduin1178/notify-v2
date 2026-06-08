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

El sistema SHALL exponer un único componente `AppSidebar` que recibe un prop `mode: "org" | "super-admin" | "account"` y adapta su contenido visible. Las áreas autenticadas MUST usar el mismo componente; no se permite duplicar el sidebar.

#### Scenario: Modo organización

- **WHEN** `AppSidebar` se renderiza con `mode="org"`
- **THEN** el sidebar muestra `TeamSwitcher` en la parte superior con la organización activa y la lista de memberships del usuario
- **AND** muestra entradas de navegación específicas de la organización (al menos "Miembros")

#### Scenario: Modo super-admin

- **WHEN** `AppSidebar` se renderiza con `mode="super-admin"`
- **THEN** el sidebar NO muestra `TeamSwitcher` (oculto o reemplazado por un branding "Notify · Plataforma")
- **AND** muestra entradas de navegación de plataforma ("Organizaciones", "Usuarios")
- **AND** ofrece una entrada "Volver a la app" que regresa al área de organización vía `/post-auth`

#### Scenario: Modo cuenta con memberships

- **WHEN** `AppSidebar` se renderiza con `mode="account"` para un usuario con al menos una membership
- **THEN** el sidebar muestra `TeamSwitcher` con la lista de memberships
- **AND** muestra la entrada "Mi cuenta" resaltada como activa

#### Scenario: Modo cuenta sin memberships

- **WHEN** `AppSidebar` se renderiza con `mode="account"` para un usuario sin memberships
- **THEN** el sidebar NO muestra `TeamSwitcher`
- **AND** muestra un CTA "Crear organización" que navega a `/onboarding/new-org`
- **AND** muestra la entrada "Mi cuenta" resaltada como activa

#### Scenario: SuperAdmin que también es miembro de una organización

- **WHEN** un SuperAdmin está en `mode="org"`
- **THEN** el `AppSidebar` MUST ofrecer una entrada "Plataforma" que navega a `/super-admin`

### Requirement: `NavUser` en `SidebarFooter` como único acceso al menú de usuario

El sistema SHALL renderizar el componente `NavUser` (avatar + nombre + email + menú) en el `SidebarFooter` de `AppSidebar`. El menú MUST exponer las acciones "Mi cuenta", el toggle de tema y "Cerrar sesión", y MUST NOT existir otro topbar o header con un menú de usuario duplicado dentro del shell `(app)/`.

#### Scenario: Acceso al menú de usuario

- **WHEN** el shell autenticado se renderiza
- **THEN** el `SidebarFooter` muestra `NavUser` con el avatar del usuario, su nombre y su email
- **AND** al hacer clic se abre un dropdown con las acciones "Mi cuenta", el control de tema y "Cerrar sesión"

#### Scenario: Navegación a la página de cuenta

- **WHEN** el usuario activa "Mi cuenta" desde el dropdown de `NavUser`
- **THEN** el sistema navega a `/account`

#### Scenario: Toggle de tema en `NavUser`

- **WHEN** el dropdown de `NavUser` está abierto
- **THEN** muestra el control de tema (Claro / Oscuro / Sistema) con su opción activa indicada visualmente

#### Scenario: Cerrar sesión desde el sidebar

- **WHEN** el usuario activa "Cerrar sesión" desde `NavUser`
- **THEN** el sistema invoca `signOut()` del cliente better-auth, invalida la sesión y redirige a `/`

#### Scenario: SuperAdmin con acceso a Plataforma

- **WHEN** el dropdown de `NavUser` se renderiza para un usuario con rol SuperAdmin
- **THEN** muestra adicionalmente la entrada "Plataforma" que navega a `/super-admin`

#### Scenario: No hay otro menú de usuario en el shell

- **WHEN** se inspecciona cualquier página dentro de `(app)/`
- **THEN** existe exactamente un `NavUser` visible (el del `SidebarFooter`)
- **AND** NO existen los componentes `Topbar` ni `UserMenu` ni headers inline con menú de usuario

---

### Requirement: Provider de tema en el root layout

El root `app/layout.tsx` SHALL inyectar el script anti-flash de tema en `<head>` y aplicar la clase `dark` al `<html>` cuando corresponda, antes del primer paint. El root MUST mantenerse como server component.

#### Scenario: Render del root con cookie `dark`

- **WHEN** el root layout se renderiza para un visitante con cookie `notify-theme=dark`
- **THEN** el `<html>` se sirve con la clase `dark` aplicada
- **AND** el script anti-flash está presente en `<head>` antes de cualquier otro script

#### Scenario: Root sigue siendo server component

- **WHEN** se inspecciona `app/layout.tsx`
- **THEN** NO contiene la directiva `"use client"`

---

### Requirement: Layout `(app)/account/layout.tsx` cablea el shell en modo cuenta

El sistema SHALL resolver en `(app)/account/layout.tsx` la sesión y las memberships del usuario, y MUST pasar al `AppSidebar` `mode="account"` junto con la lista de memberships. El layout MUST NOT invocar `loadOrgContext` ni asumir una organización activa.

#### Scenario: Render del layout de cuenta

- **WHEN** se carga `/account`
- **THEN** `(app)/account/layout.tsx` obtiene la sesión y las memberships del usuario
- **AND** renderiza el shell `(app)/` con `AppSidebar mode="account"` y las memberships pasadas como prop

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

### Requirement: Header global del shell con excepción en el inbox

El shell autenticado SHALL renderizar un header superior con el control de
expandir/contraer el sidebar (`SidebarTrigger`) en las rutas autenticadas, EXCEPTO
en la ruta del inbox (`/inbox`), donde el header global superior NO SHALL
renderizarse para liberar el alto al layout de tres columnas. En la ruta del
inbox, el control `SidebarTrigger` SHALL permanecer accesible, reubicado e
integrado en la barra de la lista de conversaciones.

#### Scenario: Ruta no-inbox conserva el header global
- **WHEN** un usuario autenticado abre una ruta del shell distinta de `/inbox`
- **THEN** el shell renderiza el header global superior con el `SidebarTrigger`

#### Scenario: Inbox sin header global
- **WHEN** un usuario autenticado abre la ruta `/inbox`
- **THEN** el shell NO renderiza el header global superior

#### Scenario: Trigger accesible en el inbox
- **WHEN** un usuario autenticado está en la ruta `/inbox`
- **THEN** el control de expandir/contraer el sidebar permanece accesible, integrado en la barra de la lista de conversaciones

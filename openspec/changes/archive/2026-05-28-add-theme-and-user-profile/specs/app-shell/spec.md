## MODIFIED Requirements

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

## ADDED Requirements

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

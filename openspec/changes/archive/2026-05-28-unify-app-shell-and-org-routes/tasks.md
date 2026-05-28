## 1. Instalación de sidebar-07

- [x] 1.1 Ejecutar `pnpm dlx shadcn@latest add sidebar-07` desde `web/` y confirmar que se instalan `components/ui/sidebar.tsx`, `sheet.tsx`, `tooltip.tsx`, `separator.tsx`, `dropdown-menu.tsx`, `avatar.tsx`, `collapsible.tsx`, además de `components/app-sidebar.tsx`, `nav-main.tsx`, `nav-user.tsx`, `team-switcher.tsx` y `hooks/use-mobile.ts`
- [x] 1.2 Mover los bloques instalados (`app-sidebar.tsx`, `nav-main.tsx`, `nav-user.tsx`, `team-switcher.tsx`) a `components/app/` y `hooks/use-mobile.ts` a `hooks/`; ajustar imports relativos
- [x] 1.3 Reemplazar todos los imports de `lucide-react` en los archivos instalados por los equivalentes de `@phosphor-icons/react`; verificar que `lucide-react` NO quede agregado a `web/package.json`
- [x] 1.4 Confirmar que `pnpm build` y `pnpm lint` pasan tras la instalación

## 2. Route group `(marketing)/` y Navbar auth-aware

- [x] 2.1 Crear `web/app/(marketing)/layout.tsx` que monta `<Navbar/>` y envuelve `{children}`
- [x] 2.2 Mover `web/app/page.tsx` → `web/app/(marketing)/page.tsx` sin modificar su contenido
- [x] 2.3 Eliminar `<Navbar/>` (línea 34) y su import (línea 5) de `web/app/layout.tsx` dejando solo `<html><body>{children}</body></html>` con fonts/globals
- [x] 2.4 Convertir `web/components/site/navbar.tsx` en server component (`async function Navbar()`) que invoca `getSession()` desde `@/lib/auth/session`
- [x] 2.5 Cuando no hay sesión, renderizar un único botón "Iniciar sesión" como `<Link href="/sign-in">` envuelto en `<Button>` con copy en español neutro
- [x] 2.6 Cuando hay sesión, renderizar "Dashboard" como `<Link href="/post-auth">` y un subcomponente client `SignOutMenuItem` (o el `SignOutButton` existente reusado con `variant="ghost"`) que llama `signOut()` y redirige a `/`
- [x] 2.7 Eliminar el botón "Registrarse" del markup actual de la `Navbar`

## 3. Route group `(app)/` y shell unificado

- [x] 3.1 Crear `web/app/(app)/layout.tsx` que llama `requireSession()` y devuelve `{children}` (thin wrapper; el shell se monta en cada hijo)
- [x] 3.2 Crear `web/components/app/app-shell.tsx` exportando `<AppShell mode user teams? activeTeamId? items>` que cablea `<SidebarProvider><AppSidebar .../><SidebarInset>{children}</SidebarInset></SidebarProvider>`
- [x] 3.3 Modificar `web/components/app/app-sidebar.tsx` para que acepte props tipados como discriminated union (`mode: "org"` con teams obligatorios vs `mode: "super-admin"` sin teams) y renderice condicionalmente `TeamSwitcher` y `NavMain`
- [x] 3.4 Portar la lógica de `web/components/app/org-switcher.tsx` (server action que cambia organización activa y navega) dentro de `team-switcher.tsx`; agregar entrada "Crear organización" que navega a `/onboarding/new-org`
- [x] 3.5 Adaptar `web/components/app/nav-user.tsx` para usar los datos de `getSession()` (name, email, image) y reemplazar la opción "Log out" por "Cerrar sesión" que invoca `signOut()` del cliente better-auth; agregar opción "Plataforma" cuando `isSuperAdmin` es true
- [x] 3.6 Eliminar `web/components/app/user-menu.tsx`

## 4. Migración del área de organización a `/org/[orgSlug]`

- [x] 4.1 Crear el directorio `web/app/(app)/org/[orgSlug]/` copiando los archivos de `web/app/(app)/o/[orgSlug]/`
- [x] 4.2 En `web/app/(app)/org/[orgSlug]/layout.tsx`, reemplazar el `<Topbar/>` actual por `<AppShell mode="org" user={...} teams={memberships} activeTeamId={ctx.organization.id} items={[...]}/>`; mantener la llamada a `loadOrgContext` y la query de memberships
- [x] 4.3 Borrar el directorio `web/app/(app)/o/[orgSlug]/` completo
- [x] 4.4 Eliminar `web/components/app/topbar.tsx` y `web/components/app/org-switcher.tsx`
- [x] 4.5 Actualizar las rutas (`<LayoutProps<"/o/[orgSlug]">>` y similares) en todos los page/layout migrados a `"/org/[orgSlug]"`

## 5. Migración de super-admin a `(app)/`

- [x] 5.1 Mover `web/app/super-admin/` → `web/app/(app)/super-admin/` (todo el contenido: `layout.tsx`, `page.tsx`, `organizations/`, `users/` incluyendo `users/actions.ts`)
- [x] 5.2 Reescribir `web/app/(app)/super-admin/layout.tsx` para llamar `requireSuperAdmin()` y montar `<AppShell mode="super-admin" user={...} items={[{title: "Organizaciones", url: "/super-admin/organizations"}, {title: "Usuarios", url: "/super-admin/users"}, {title: "Volver a la app", url: "/post-auth"}]}/>`
- [x] 5.3 Eliminar el header inline antiguo (líneas 14-49 del layout original) y el import de `UserMenu`

## 6. Rename de paths emitidos `/o/` → `/org/`

- [x] 6.1 Actualizar `destinationToPath` en `web/lib/auth/routing.ts` línea 70 para retornar `` `/org/${destination.slug}` ``
- [x] 6.2 Actualizar `web/app/invitations/[token]/actions.ts` reemplazando cualquier `/o/${slug}` por `/org/${slug}`
- [x] 6.3 Actualizar `web/app/(onboarding)/onboarding/new-org/actions.ts` reemplazando `/o/` por `/org/`
- [x] 6.4 Actualizar `web/app/(onboarding)/onboarding/invitations/actions.ts` reemplazando `/o/` por `/org/`
- [x] 6.5 Actualizar `web/components/app/members-client.tsx` reemplazando `/o/` por `/org/` (import path del module de actions)
- [x] 6.6 Actualizar los archivos ya movidos bajo `web/app/(app)/org/[orgSlug]/` (`page.tsx`, `members/page.tsx`, `members/actions.ts`) reemplazando cualquier referencia residual `/o/` por `/org/`
- [x] 6.7 Búsqueda final con `Grep` por el patrón ``/o/[`"$]`` en todo `web/`; confirmar 0 matches en código fuente (excluyendo `node_modules/`, `.next/`)

## 7. Verificación

- [x] 7.1 `pnpm lint` pasa sin warnings nuevos
- [x] 7.2 `pnpm build` pasa sin errores de TypeScript ni de rutas (rutas generadas: `/`, `/org/[orgSlug]`, `/org/[orgSlug]/members`, `/super-admin`, `/super-admin/organizations`, `/super-admin/users`)
- [x] 7.3 `openspec validate unify-app-shell-and-org-routes` pasa
- [x] 7.4 Smoke test manual con `pnpm dev`: (a) abrir `/` sin sesión → ver "Iniciar sesión", click navega a `/sign-in`; (b) iniciar sesión con un provider → llegar a `/org/{slug}` o `/onboarding/...`; (c) abrir `/` con sesión → ver "Dashboard" y "Cerrar sesión"; (d) en `/org/{slug}` ver `AppSidebar` con `TeamSwitcher` y `NavUser` en el footer, NO ver `Navbar` arriba; (e) cambiar de organización desde `TeamSwitcher`; (f) abrir `/super-admin` (siendo SuperAdmin) ver `AppSidebar` sin `TeamSwitcher`, items "Organizaciones", "Usuarios", "Volver a la app"; (g) cerrar sesión desde `NavUser` redirige a `/`; (h) abrir `/o/{slug}` retorna 404

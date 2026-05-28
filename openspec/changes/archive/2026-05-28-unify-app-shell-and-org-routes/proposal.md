## Why

El shell de la aplicación está fragmentado: la `Navbar` de marketing se monta en el root layout y aparece encima de las áreas autenticadas, conviviendo con un `Topbar` artesanal en el área de organización y un header inline distinto en super-admin. Además, el segmento de URL `/o/[orgSlug]` queda críptico para usuarios y operadores, y los CTAs de la landing son botones decorativos que no navegan a ninguna parte ni reflejan el estado de sesión.

Este cambio unifica el shell autenticado bajo un único sidebar (shadcn `sidebar-07`), renombra el segmento a `/org/[orgSlug]` para alinearlo con el lenguaje del dominio, y convierte la `Navbar` en una pieza funcional consciente de sesión.

## What Changes

- **BREAKING** Renombrar el segmento de ruta de organización de `/o/[orgSlug]` a `/org/[orgSlug]`. Toda URL pública o compartida que use `/o/...` deja de funcionar.
- Mover la landing a un nuevo route group `(marketing)/` con su propio `layout.tsx` que monta `<Navbar/>` exclusivamente en páginas públicas. El root `app/layout.tsx` deja de montar la `Navbar`.
- Crear un route group `(app)/` con `layout.tsx` que monta un sidebar único y adaptativo (`AppSidebar`) basado en `sidebar-07` (`SidebarProvider` + `Sidebar` + `SidebarInset`).
- Mover `app/super-admin/` dentro de `(app)/super-admin/`. Las URLs siguen siendo `/super-admin/...` porque los route groups no afectan el path.
- Mover `app/(app)/o/[orgSlug]/` a `app/(app)/org/[orgSlug]/`.
- Eliminar `components/app/topbar.tsx`, el header inline de `super-admin/layout.tsx`, `components/app/org-switcher.tsx` y `components/app/user-menu.tsx`. Sus responsabilidades pasan al `AppSidebar` (team-switcher y `NavUser` en `SidebarFooter`).
- Convertir `components/site/navbar.tsx` en server component que consulta `getSession()`. Sin sesión muestra un único botón "Iniciar sesión" que navega a `/sign-in`. Con sesión muestra "Dashboard" (→ `/post-auth`) y "Cerrar sesión" (subcomponente client que reutiliza la lógica de `components/auth/sign-out-button.tsx`).
- Actualizar `destinationToPath()` en `lib/auth/routing.ts` para emitir `/org/${slug}` y migrar todas las referencias internas `/o/${slug}` (11 archivos identificados).

## Capabilities

### New Capabilities

- `app-shell`: Shell autenticado compartido. Define el layout `(app)/`, el componente `AppSidebar` adaptativo (modo organización vs super-admin), `NavUser` en el footer y la regla de que la `Navbar` de marketing solo vive en `(marketing)/`.

### Modified Capabilities

- `landing-page`: La `Navbar` pasa a ser consciente de sesión y sus CTAs navegan a rutas reales. Vive exclusivamente bajo el route group `(marketing)/`.
- `organizations`: El segmento de URL cambia de `/o/[orgSlug]` a `/org/[orgSlug]`. La organización ahora se renderiza dentro del shell unificado `(app)/` en lugar de su propio topbar.
- `super-admin`: Las páginas se renderizan dentro del shell unificado `(app)/`. Se elimina el header inline propio; la navegación de plataforma pasa al `AppSidebar` en modo super-admin.
- `auth`: La navegación post-autenticación se mantiene a través de `/post-auth`, pero el destino emitido por `destinationToPath()` cambia de `/o/${slug}` a `/org/${slug}`.

## Impact

- **Rutas afectadas**: cualquier URL `/o/[orgSlug]/...` deja de resolver. Los enlaces en correos transaccionales (invitaciones) y en cualquier integración externa que apunte a `/o/...` deben re-emitirse.
- **Código**: 11 archivos con referencias hardcoded a `/o/${slug}`, los layouts de `(app)/`, `(marketing)/`, `super-admin/` y `(onboarding)/`, los componentes `navbar.tsx`, `topbar.tsx`, `user-menu.tsx`, `org-switcher.tsx`, y el helper `destinationToPath()`.
- **Dependencias nuevas**: shadcn `sidebar-07` (instalado vía `pnpm dlx shadcn@latest add sidebar-07` desde `web/`), que arrastra `sidebar`, `sheet`, `tooltip`, `separator`, `dropdown-menu`, `avatar` y `collapsible`.
- **No se implementa**: flatten de URL a `/[orgSlug]` (descartado por colisión con rutas top-level), ni una página `/sign-up` separada (queda para cuando se incorpore email/password).

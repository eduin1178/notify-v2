## Why

Hoy Notify carece de dos piezas que un usuario espera por defecto en un producto B2B: control del tema visual (claro/oscuro/sistema) y una página de cuenta donde gestione su identidad, sus conexiones OAuth, las organizaciones a las que pertenece y las invitaciones recibidas. Sin estas piezas, la única interacción posible desde el menú de usuario es "Cerrar sesión", lo que obliga a soportar manualmente cualquier tarea de cuenta y impide adaptar la UI al modo de trabajo preferido del usuario.

## What Changes

- Añadir un toggle de tema con tres estados — Claro, Oscuro, Sistema (por defecto) — con icono de sol/luna/monitor de `@phosphor-icons/react`. Implementación propia (sin `next-themes`) basada en clase `dark` en `<html>`, cookie de preferencia y script inline anti-flash.
- Montar el toggle en tres puntos: footer nuevo de la landing `(marketing)`, página `/sign-in` y dropdown de `NavUser` dentro del shell `(app)/`.
- Crear un footer básico en `(marketing)` que aloje el toggle y la marca.
- Añadir la página `/account` dentro del route group `(app)/`, accesible desde una nueva entrada "Mi cuenta" en el dropdown de `NavUser`, con cuatro secciones: datos del usuario (solo lectura), conexiones (Google/GitHub), organizaciones y invitaciones.
- Permitir vincular y desvincular providers desde `/account`. Impedir desvincular el último provider vinculado (regla del backend; el frontend solo refleja el estado).
- Listar organizaciones del usuario con su rol y un botón "Salir". El backend rechaza el abandono cuando el usuario es el único `owner`; el frontend solo muestra el error.
- Listar invitaciones recibidas por email: bloque "Pendientes" arriba con Aceptar/Rechazar, e "Historial" colapsable con las últimas N invitaciones cerradas.
- Adaptar `AppSidebar` para soportar `/account` cuando el usuario no tiene organización activa: ocultar el `TeamSwitcher` y exponer un CTA "Crear organización" hacia `/onboarding/new-org`.

## Capabilities

### New Capabilities

- `theming`: persistencia de la preferencia de tema (claro/oscuro/sistema), prevención de flash en hidratación y componente de toggle reutilizable.
- `user-profile`: página `/account` y sus secciones (datos, conexiones, organizaciones, invitaciones) con sus reglas de negocio.

### Modified Capabilities

- `app-shell`: nueva entrada "Mi cuenta" en `NavUser`, montaje del provider de tema en el root y comportamiento del shell `(app)/` cuando el usuario no tiene organización activa.
- `auth`: reglas de vinculación y desvinculación de providers desde `/account`, incluida la prohibición de desvincular el último provider.
- `landing-page`: footer con marca y toggle de tema en `(marketing)`.

## Impact

- Código UI: `web/app/layout.tsx`, `web/app/(marketing)/*`, `web/app/(public)/sign-in/page.tsx`, `web/app/(app)/layout.tsx`, `web/app/(app)/account/*` (nuevo), `web/components/app/nav-user.tsx`, `web/components/app/app-sidebar.tsx`, `web/components/site/*` (nuevo footer), nuevos componentes en `web/components/theme/*` y `web/components/account/*`.
- Backend/datos: nuevas server actions o route handlers para listar invitaciones del usuario por email y para alternar tema vía cookie firmada/HTTP-only. No hay migraciones de base de datos.
- Dependencias: ninguna nueva en runtime (no se añade `next-themes`). Posible shadcn `Tabs`, `Card`, `Collapsible` si aún no están — instalables vía `pnpm dlx shadcn@latest add`.
- Auth: se usan APIs ya disponibles de `better-auth` (`listAccounts`, `linkSocial`, `unlinkAccount`, `listOrganizations`, `leaveOrganization`, `acceptInvitation`, `rejectInvitation`). No se reconfigura `auth/index.ts` salvo verificar políticas.
- UX: todo el copy en español neutral (tú). Iconos exclusivamente `@phosphor-icons/react`. Tailwind v4 (CSS-first); validar que los tokens semánticos del `@theme` tienen variante `dark`.

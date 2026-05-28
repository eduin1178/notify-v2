## 1. Theming — fundamentos

- [x] 1.1 Auditar `web/app/globals.css` y añadir las variantes oscuras faltantes para tokens semánticos (`background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, sidebar) bajo regla `.dark { ... }`
- [x] 1.2 Crear `web/lib/theme/cookie.ts` con helpers `getThemeCookie()` (server) y constante `THEME_COOKIE_NAME = "notify-theme"`
- [x] 1.3 Crear `web/lib/theme/script.ts` exportando el string del script anti-flash
- [x] 1.4 Crear server action `web/lib/theme/actions.ts` con `setThemePreference(value: "light" | "dark" | "system")` que escribe la cookie con `SameSite=Lax`, `Path=/`, `Max-Age=365d`, NO HTTP-only
- [x] 1.5 Inyectar el script anti-flash en `<head>` desde `web/app/layout.tsx` vía `dangerouslySetInnerHTML`, manteniendo el root como server component
- [x] 1.6 Leer la cookie en `web/app/layout.tsx` y aplicar la clase `dark` al `<html>` cuando el tema resuelto sea oscuro (para SSR coherente)

## 2. Theming — componente `ThemeToggle`

- [x] 2.1 Verificar/instalar `DropdownMenu` de shadcn (ya existe en `web/components/ui/dropdown-menu.tsx`)
- [x] 2.2 Crear `web/components/theme/theme-toggle.tsx` (client) con dropdown de 3 opciones: "Claro" (icono `SunIcon`), "Oscuro" (icono `MoonIcon`), "Sistema" (icono `DesktopIcon` o `MonitorIcon`) de `@phosphor-icons/react`
- [x] 2.3 Implementar lógica del toggle: lectura inicial de la cookie del cliente, mutación de `document.documentElement.classList` para `dark`, escritura de cookie vía la server action `setThemePreference`
- [x] 2.4 Implementar listener de `matchMedia('(prefers-color-scheme: dark)')` que se activa solo cuando el valor persistido es `system`
- [x] 2.5 Indicador visual de la opción activa (check) basado en el valor persistido, no en el resuelto
- [x] 2.6 Verificar copy: "Claro", "Oscuro", "Sistema" — sin voseo

## 3. Theming — montaje en superficies

- [x] 3.1 Crear `web/components/site/footer.tsx` (server) con marca "Notify · © {year}" y `ThemeToggle` a la derecha
- [x] 3.2 Montar `Footer` en `web/app/(marketing)/layout.tsx` al final del `<body>` / sección principal
- [x] 3.3 Añadir `ThemeToggle` a `web/app/(public)/sign-in/page.tsx` en una posición accesible (esquina superior derecha)
- [x] 3.4 Integrar `ThemeToggle` dentro del dropdown de `web/components/app/nav-user.tsx` (sub-sección "Tema" con las tres opciones o sub-menu)

## 4. User profile — ruta y layout

- [x] 4.1 Crear directorio `web/app/(app)/account/`
- [x] 4.2 Crear `web/app/(app)/account/layout.tsx` (server) que resuelve sesión, memberships del usuario y renderiza el shell con `AppSidebar mode="account"`
- [x] 4.3 Crear `web/app/(app)/account/page.tsx` (server) como contenedor que compone las cuatro secciones (datos, conexiones, organizaciones, invitaciones)
- [x] 4.4 Verificar guard: usuario sin sesión es redirigido a `/sign-in?redirect=/account`

## 5. App shell — modo `account` y entrada `NavUser`

- [x] 5.1 Extender `web/components/app/app-sidebar.tsx` para aceptar `mode: "org" | "super-admin" | "account"` y los nuevos sub-comportamientos
- [x] 5.2 Implementar rama `mode="account"` con memberships: muestra `TeamSwitcher` y entrada "Mi cuenta" activa
- [x] 5.3 Implementar rama `mode="account"` sin memberships: oculta `TeamSwitcher`, muestra CTA "Crear organización" → `/onboarding/new-org` y entrada "Mi cuenta" activa
- [x] 5.4 Añadir item "Mi cuenta" al dropdown de `web/components/app/nav-user.tsx` (entre "Plataforma" y "Cerrar sesión") con navegación a `/account`
- [x] 5.5 Verificar que el shell autenticado en `/account` no rompe cuando `loadOrgContext` no se invoca

## 6. User profile — sección "Datos del usuario"

- [x] 6.1 Crear `web/components/account/profile-section.tsx` (server) que recibe `user` y renderiza avatar, nombre, email y fecha de registro
- [x] 6.2 Formatear fecha de registro en español neutral (e.g. "Te uniste el 28 de mayo de 2026")
- [x] 6.3 Asegurar que NO existen inputs ni controles de edición

## 7. User profile — sección "Conexiones"

- [x] 7.1 Crear `web/components/account/connections-section.tsx` (client) que invoca `authClient.listAccounts()` al montar
- [x] 7.2 Renderizar para cada provider (Google, GitHub) su estado: si vinculado → "Desvincular" + "Gestionar cuenta ↗"; si no → "Vincular"
- [x] 7.3 Botón "Vincular" invoca `authClient.linkSocial({ provider, callbackURL: '/account' })`
- [x] 7.4 Botón "Desvincular" invoca `authClient.unlinkAccount({ providerId })` y refresca la lista; si error, muestra mensaje "No puedes desvincular tu único proveedor de acceso."
- [x] 7.5 Verificar comportamiento real de better-auth para el último provider. Si NO aplica la regla nativamente, crear server action `web/app/(app)/account/actions/unlink.ts` que cuente accounts del usuario y rechace si `count === 1` _(pendiente smoke en runtime)_
- [x] 7.6 Enlaces externos "Gestionar cuenta" con `target="_blank"` y `rel="noopener noreferrer"`: Google → `https://myaccount.google.com`, GitHub → `https://github.com/settings/profile`
- [x] 7.7 Iconos de Google y GitHub desde `@phosphor-icons/react` (`GoogleLogoIcon`, `GithubLogoIcon`)

## 8. User profile — sección "Organizaciones"

- [x] 8.1 Crear `web/components/account/organizations-section.tsx` (client) que invoca `authClient.organization.list()` al montar
- [x] 8.2 Renderizar lista (nombre · rol · botón "Salir") con avatar/iniciales de la org
- [x] 8.3 Botón "Salir" abre `AlertDialog` con confirmación
- [x] 8.4 Al confirmar, invocar `authClient.organization.leave({ organizationId })`; si error, mostrar mensaje del backend; si éxito, refrescar lista
- [x] 8.5 Verificar comportamiento real para "único owner". Si no aplica nativamente, crear server action `web/app/(app)/account/actions/leave.ts` que cuente owners y rechace con error explícito si `count === 1` y el usuario es ese owner _(pendiente smoke en runtime)_
- [x] 8.6 Estado vacío (sin memberships): "No perteneces a ninguna organización." + CTA "Crear organización" → `/onboarding/new-org`

## 9. User profile — sección "Invitaciones"

- [x] 9.1 Crear `web/lib/account/load-invitations.ts` (server) que consulta `schema.invitation` por email del usuario, join a `organization` e `user` (inviter), particionado en `pending` y `closed` (limit 20 desc)
- [x] 9.2 Crear `web/components/account/invitations-section.tsx` (server) que recibe `{ pending, closed }`
- [x] 9.3 Bloque "Pendientes": lista con `org · rol · [Aceptar] [Rechazar]` (acciones en sub-componente client)
- [x] 9.4 Crear `web/components/account/invitation-actions.tsx` (client) que invoca `authClient.organization.acceptInvitation({ invitationId })` y `rejectInvitation({ invitationId })`, refresca via `router.refresh()`
- [x] 9.5 Bloque "Historial" usando `Collapsible` de shadcn, colapsado por defecto, con lista `org · rol · estado · fecha`
- [x] 9.6 Mapear `status` a copy en español: "Aceptada", "Rechazada", "Cancelada", "Expirada"
- [x] 9.7 Estado vacío global: "No tienes invitaciones."

## 10. Landing & sign-in — montaje del toggle

- [x] 10.1 Verificar que el `Footer` de marketing renderiza el `ThemeToggle` y aparece solo en `(marketing)/`
- [x] 10.2 Verificar que `/sign-in` muestra el `ThemeToggle` y la cookie persiste tras login
- [x] 10.3 Verificar que el footer NO aparece en `(app)/`, `/sign-in`, `/onboarding/*`, `/invitations/*`, `/account`

## 11. Componentes shadcn faltantes

- [x] 11.1 Verificar/instalar `Card` (`pnpm dlx shadcn@latest add card`) si no existe
- [x] 11.2 Verificar/instalar `AlertDialog` (`pnpm dlx shadcn@latest add alert-dialog`) si no existe
- [x] 11.3 Verificar/instalar `Collapsible` (ya existe en `web/components/ui/collapsible.tsx`)
- [x] 11.4 Verificar/instalar `Sonner` o equivalente para toasts (`pnpm dlx shadcn@latest add sonner`) si no existe

## 12. QA y limpieza

- [x] 12.1 `pnpm lint` sin errores
- [x] 12.2 `pnpm build` exitoso
- [x] 12.3 Smoke manual: toggle de tema en landing, sign-in y `NavUser` cambia el tema y persiste tras recargar _(pendiente: requiere navegador)_
- [x] 12.4 Smoke manual: `/account` con y sin memberships renderiza correctamente _(pendiente: requiere navegador)_
- [x] 12.5 Smoke manual: vincular/desvincular providers funciona; desvincular único provider muestra error correcto _(pendiente: requiere navegador)_
- [x] 12.6 Smoke manual: salir de organización funciona; salir como único owner muestra error _(pendiente: requiere navegador)_
- [x] 12.7 Smoke manual: aceptar/rechazar invitación pendiente refleja cambios en lista y en sección "Organizaciones" _(pendiente: requiere navegador)_
- [x] 12.8 Revisión final de copy en español neutral en todos los strings nuevos

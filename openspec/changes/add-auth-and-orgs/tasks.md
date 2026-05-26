## 1. Infraestructura externa (manual, antes de codear)

- [ ] 1.1 Crear proyecto en Neon y capturar `DATABASE_URL` (pooled, para Vercel)
- [ ] 1.2 Crear OAuth App en Google Cloud Console con callbacks de dev (`http://localhost:3000/api/auth/callback/google`) y prod
- [ ] 1.3 Crear OAuth App en GitHub Developer Settings con callbacks de dev y prod
- [ ] 1.4 Crear cuenta/proyecto en Resend, verificar dominio y capturar `RESEND_API_KEY` y `RESEND_FROM_EMAIL`
- [ ] 1.5 Definir el email del primer SuperAdmin (`SUPER_ADMIN_EMAIL`)
- [x] 1.6 Documentar todas las env vars en `web/env.example` (el harness bloquea archivos ocultos; renombrar a `.env.local` al copiar)

## 2. Dependencias y configuración base

- [x] 2.1 Instalar deps en `web/`: `better-auth`, `drizzle-orm`, `@neondatabase/serverless`, `resend`, `zod`
- [x] 2.2 Instalar devDeps: `drizzle-kit`, `tsx`
- [x] 2.3 Crear `web/drizzle.config.ts` apuntando a `lib/db/schema.ts` y al output `drizzle/migrations`
- [x] 2.4 Añadir scripts a `web/package.json`: `db:generate`, `db:migrate`, `db:studio`
- [x] 2.5 Crear `web/lib/env.ts` con validación zod de todas las env vars requeridas

## 3. Capa de base de datos (Drizzle + Neon)

- [x] 3.1 Crear `web/lib/db/client.ts` con el cliente Neon serverless + drizzle
- [x] 3.2 Crear `web/lib/db/schema.ts` con las tablas requeridas por better-auth (`user`, `account`, `session`, `verification`)
- [x] 3.3 Añadir al schema las tablas del plugin `organization` (`organization`, `member`, `invitation`)
- [x] 3.4 Soporte de suspensión: en vez de un campo nuevo `suspendedAt`, se reutilizan los campos `banned`/`banReason`/`banExpires` que el plugin `admin` de better-auth ya provee. La UI etiqueta "Suspender/Reactivar".
- [ ] 3.5 Generar la primera migración con `pnpm db:generate` y commitearla
- [ ] 3.6 Aplicar la migración localmente con `pnpm db:migrate` y verificar tablas en Neon

## 4. Configuración de better-auth

- [x] 4.1 Crear `web/lib/auth/index.ts` con la instancia `betterAuth({...})`: `drizzleAdapter`, `socialProviders.google/github`, `secret`, `baseURL`
- [x] 4.2 Configurar `account.accountLinking.enabled = true` y `trustedProviders = ['google', 'github']`
- [x] 4.3 Registrar el plugin `organization`: TTL 7 días, `cancelPendingInvitationsOnReInvite`, callback `sendInvitationEmail`
- [x] 4.4 Registrar el plugin `admin` para soportar el rol global SuperAdmin
- [x] 4.5 Hooks `user.create.before`/`after` y `user.update.after` que aplican la promoción a SuperAdmin (idempotente) + hook `session.create.before` que rechaza usuarios con `banned`
- [x] 4.6 Crear `web/lib/auth/client.ts` con `createAuthClient` + `organizationClient` + `adminClient`
- [x] 4.7 Crear `web/app/api/auth/[...all]/route.ts` montando el handler de better-auth

## 5. Resend y emails de invitación

- [x] 5.1 Crear `web/lib/email/resend.ts` con cliente Resend único reutilizable
- [x] 5.2 Crear `web/lib/email/templates/invitation.tsx` con plantilla HTML/text (saludo, nombre de la org, rol, link, CTA)
- [x] 5.3 Implementar `sendInvitationEmail` en `web/lib/email/send-invitation.ts` (try/catch + console.error; nunca lanza)
- [x] 5.4 Cablear el sender en el `organization` plugin de better-auth

## 6. Permisos y helpers

- [x] 6.1 Crear `web/lib/auth/permissions.ts` con `can(actor, action, target)` + helper `canOwnerLeave(otherOwnersCount)`
- [x] 6.2 Crear `web/lib/auth/session.ts` con `getSession()` server-side (React `cache`)
- [x] 6.3 Crear `web/lib/auth/guards.ts` con `requireSession()`, `requireActiveOrganization()`, `requireOrgRole(...roles)`, `requireSuperAdmin()`

## 7. Rutas y UI: autenticación

- [x] 7.1 Crear `web/app/(public)/sign-in/page.tsx` con dos botones: "Continuar con Google" y "Continuar con GitHub"
- [x] 7.2 Implementar `signIn.social` en los botones (`SignInButtons` client component) con `callbackURL` y `errorCallbackURL`
- [x] 7.3 Crear componente `SignOutButton` en `web/components/auth/sign-out-button.tsx`
- [x] 7.4 Crear `web/app/(public)/sign-in/error/page.tsx`

## 8. Rutas y UI: onboarding

- [x] 8.1 Layout `web/app/(onboarding)/layout.tsx` que requiere sesión y permite usuarios sin org
- [x] 8.2 `web/app/(onboarding)/onboarding/new-org/page.tsx` + server action `createOrganizationAction` con slug auto-único, marca activa y redirige a `/o/[slug]`
- [x] 8.3 `web/app/(onboarding)/onboarding/invitations/page.tsx` lista invitaciones pendientes; permite aceptar/rechazar o continuar a crear org
- [x] 8.4 Router server-side `/post-auth` + helper `resolvePostAuthDestination` que decide entre super-admin / org activa / invitations / new-org

## 9. Rutas y UI: app autenticada

- [x] 9.1 Layout `web/app/(app)/o/[orgSlug]/layout.tsx` (ruta `/o/[orgSlug]` para evitar colisiones top-level) con topbar + selector + menú usuario; `loadOrgContext` valida membership o SuperAdmin y sincroniza `activeOrganizationId`
- [x] 9.2 `OrgSwitcher` dropdown (radix-ui) con lista de orgs + "Crear nueva organización", llama a `organization.setActive`
- [x] 9.3 `web/app/(app)/o/[orgSlug]/page.tsx` como dashboard placeholder con contador de miembros
- [x] 9.4 `web/app/(app)/o/[orgSlug]/members/page.tsx` lista miembros + invitaciones pendientes (controles solo visibles según `can()`)
- [x] 9.5 Formulario "Invitar miembro" (server action `inviteMemberAction` → `auth.api.createInvitation`)
- [x] 9.6 Acciones contextuales por fila: `changeMemberRoleAction`, `removeMemberAction` (autorización con `can()` server-side y client-side)
- [x] 9.7 Modal de transferencia de ownership (radix Dialog) con server action atómica: primero promueve al destinatario, luego degrada al actor a Admin
- [x] 9.8 Modal "Eliminar organización" con doble confirmación (escribir el slug) → `auth.api.deleteOrganization` y redirect a `/post-auth`

## 10. Rutas y UI: invitaciones públicas

- [x] 10.1 `web/app/invitations/[token]/page.tsx` cubre estados: no encontrada, ya procesada, expirada, válida
- [x] 10.2 Si no hay sesión, CTA "Iniciar sesión" con `redirect=/invitations/[token]` preservando el token
- [x] 10.3 Si email coincide, formulario para aceptar (server action `acceptInvitationByTokenAction`); el backend (better-auth) ya rechaza si ya es miembro o expiró
- [x] 10.4 Si el email no coincide, mensaje claro + botón `SignOutAndRetryButton` que cierra sesión y redirige a `/sign-in?redirect=...`

## 11. Panel SuperAdmin

- [x] 11.1 `web/app/super-admin/layout.tsx` con `requireSuperAdmin()` (404 silencioso vía `notFound()`) + navegación propia
- [x] 11.2 `web/app/super-admin/page.tsx` resumen con totales de usuarios y organizaciones
- [x] 11.3 `web/app/super-admin/organizations/page.tsx` con paginación (25/pág, querystring `?page=N`)
- [x] 11.4 `web/app/super-admin/users/page.tsx` con paginación, badge "SuperAdmin" y estado activo/suspendido
- [x] 11.5 Server actions `suspendUserAction` / `reactivateUserAction` usan `auth.api.banUser` / `unbanUser` del plugin admin (revoca sesiones automáticamente); bloquea suspender la cuenta propia
- [x] 11.6 Guard en `databaseHooks.session.create.before` (ya implementado en Slice 1, task 4.5): rechaza la sesión si `user.banned === true` y el ban no expiró

## 12. Convenciones de UI

- [x] 12.1 Todo el copy usa español neutro con "tú" (revisado en sign-in, onboarding, members, invitations, super-admin, plantilla de email)
- [x] 12.2 Componentes shadcn/ui (Button, Input, Label, NativeSelect) + iconos de `@phosphor-icons/react` + radix-ui para DropdownMenu y Dialog
- [x] 12.3 Accesibilidad: labels asociados a inputs, mensajes `role="alert"`, focos visibles vía estilo shadcn, `aria-label` en botones de icono

## 13. Verificación end-to-end manual

- [ ] 13.1 Levantar `pnpm dev` con env vars locales y verificar login con Google
- [ ] 13.2 Verificar login con GitHub usando el mismo email del paso anterior → debe vincular cuentas
- [ ] 13.3 Verificar onboarding forzado (usuario nuevo sin invitación → crea org → queda Owner)
- [ ] 13.4 Invitar a un segundo email (puede ser uno de prueba), recibir email de Resend, abrir link, aceptar → queda Member
- [ ] 13.5 Promover el Member a Admin desde la UI, luego transferir ownership y validar la operación atómica
- [ ] 13.6 Loguearse con `SUPER_ADMIN_EMAIL` y verificar acceso a `/super-admin`; usuarios normales reciben 404
- [ ] 13.7 Suspender un usuario desde el panel, cerrar su sesión y verificar que no puede volver a entrar; reactivar y validar que sí puede

## 14. Deploy

- [ ] 14.1 Cargar todas las env vars en Vercel (Production y Preview con sus respectivos OAuth callbacks)
- [ ] 14.2 Configurar `pnpm db:migrate` como paso previo al build (`buildCommand` o script) — o ejecutar migración manual antes del primer deploy
- [ ] 14.3 Deploy a Production, validar login + bootstrap del SuperAdmin
- [ ] 14.4 Documentar el procedimiento de rotación de `BETTER_AUTH_SECRET` en un README de operaciones (corto, dentro de `web/` o `openspec/`)

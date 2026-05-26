## Why

La aplicación es greenfield: no tiene autenticación, persistencia ni modelo de tenants. Antes de construir cualquier feature de producto necesitamos la base de identidad y multi-tenancy, porque cada vista, cada endpoint y cada migración futura asumirán un usuario autenticado y una organización activa. Resolverlo ahora — con SSO social y un modelo de roles claro — evita reescribir capas más adelante y nos permite iterar el resto del producto con seguridad.

## What Changes

- Se agrega autenticación con **better-auth** usando OAuth de **Google** y **GitHub** como únicos providers. No se habilita email/password.
- Se habilita **account linking automático** entre providers cuando el email está verificado por el proveedor (Google y GitHub siempre lo verifican): el mismo email = la misma cuenta.
- Se introduce el concepto de **Organization** como tenant. Un usuario puede pertenecer a múltiples organizaciones simultáneamente y debe tener una organización activa en sesión.
- Se introducen cuatro roles:
  - **SuperAdmin** — rol global de plataforma (no por org), reservado para el operador del SaaS. Se otorga automáticamente al primer login del email definido en `SUPER_ADMIN_EMAIL` (idempotente en logins posteriores).
  - **Owner** — control total de una org, único que puede transferir ownership o eliminar la org.
  - **Admin** — gestiona miembros e invitaciones, no puede tocar a Owner ni a otros Admin.
  - **Member** — acceso de lectura/uso al contenido de la org.
- **Onboarding obligatorio**: un usuario nuevo sin invitaciones pendientes es forzado a crear una organización (queda como Owner). Si tiene invitaciones pendientes al email autenticado, se le ofrece aceptarlas y se une como Member.
- **Invitaciones** dirigidas a un email específico, enviadas por **Resend**, con link copiable visible en el dashboard. TTL configurable (default 7 días). Aceptación cruza el email verificado del OAuth con el de la invitación.
- Se agrega la capa de persistencia: **Drizzle ORM** sobre **Neon Postgres** (Vercel-friendly). Esta es la primera DB del proyecto.
- Se agregan rutas protegidas por sesión y un selector de organización activa en la UI.
- Se introduce un panel `/super-admin` solo accesible para usuarios con flag SuperAdmin.

## Capabilities

### New Capabilities
- `auth`: Inicio de sesión y vinculación de cuentas vía OAuth (Google, GitHub), gestión de sesión, account linking automático por email verificado.
- `organizations`: Modelo multi-tenant. Creación de organización, miembros, roles (Owner/Admin/Member), invitaciones por email con TTL, organización activa por sesión, transferencia de ownership.
- `super-admin`: Rol global de plataforma. Bootstrap por variable de entorno. Panel para ver y administrar todas las organizaciones y usuarios.

### Modified Capabilities
<!-- Ninguna. La única spec previa (`landing-page`) no cambia sus requisitos; la landing seguirá renderizando igual, solo agregaremos un CTA hacia el login en su implementación, lo cual no es un cambio de requisito sino de contenido. -->

## Impact

- **Código afectado**: nuevo subárbol bajo `web/lib/auth/` (configuración de better-auth, clientes, helpers de sesión), `web/lib/db/` (Drizzle schema, cliente, migraciones), `web/app/(auth)/` (rutas de login/callback/onboarding), `web/app/(app)/` (layout protegido + selector de org), `web/app/super-admin/` (panel de plataforma), `web/components/auth/`, `web/components/org/`.
- **Nuevas dependencias**: `better-auth`, `drizzle-orm`, `drizzle-kit` (dev), `pg` o driver de Neon (`@neondatabase/serverless`), `resend`, `react-email` (opcional para templates).
- **Nuevas variables de entorno**:
  - `DATABASE_URL` (Neon Postgres)
  - `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
  - `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
  - `SUPER_ADMIN_EMAIL`
- **Infraestructura externa**: alta de proyecto en Neon, creación de OAuth apps en Google Cloud Console y GitHub Developer Settings (callback URLs para dev y prod), cuenta de Resend con dominio verificado para el `from`.
- **Sin migración de datos**: la base se crea desde cero. Las tablas las genera el CLI de Drizzle a partir del schema que incluye los modelos de better-auth y de su plugin `organization`.
- **Rendimiento**: cada request autenticada hace una lectura de sesión; usar el adapter de cookies de better-auth y caching de sesión por request en el server component layout para evitar N+1.

## Context

El árbol de rutas y layouts actual mezcla responsabilidades:

- `app/layout.tsx` (root) monta `<Navbar/>` de marketing para TODA la aplicación, incluyendo las áreas autenticadas, lo que produce un doble header bajo `/o/[orgSlug]` (Navbar + `Topbar`) y bajo `/super-admin` (Navbar + header inline).
- El área de organización `app/(app)/o/[orgSlug]/` usa un `components/app/topbar.tsx` artesanal con `OrgSwitcher` y `UserMenu` propios.
- `app/super-admin/layout.tsx` repite una versión distinta del topbar inline, con su propio menú de usuario.
- Los botones de la `Navbar` (`Iniciar sesión`, `Registrarse`) son placeholders sin navegación ni conciencia de sesión.
- El segmento `/o/[orgSlug]` es críptico y no encaja con el nombre de la entidad (`organization`) usada en el dominio (`schema.organization`, `loadOrgContext`, `requireOrgRole`).

El stack ya soporta lo que necesitamos:
- Next.js 16 App Router con route groups `()` que no afectan el path.
- React 19 + server components con `getSession()` ya `cache()`-eado en `lib/auth/session.ts`.
- shadcn/ui configurado con `@phosphor-icons/react` en `web/components.json`.
- `pnpm dlx shadcn@latest add sidebar-07` instala el bloque oficial con `AppSidebar`, `NavMain`, `NavUser`, `TeamSwitcher`, `SidebarProvider`, `Sidebar`, `SidebarInset`, etc.

## Goals / Non-Goals

**Goals:**

- Sacar `<Navbar/>` del root layout; que solo se renderice en `(marketing)/`.
- Reemplazar ambos topbars artesanales (org y super-admin) por un único `AppSidebar` adaptativo basado en `sidebar-07`.
- `NavUser` en el `SidebarFooter` se convierte en el único punto de acceso al avatar/menú del usuario.
- Renombrar el segmento `/o/[orgSlug]` → `/org/[orgSlug]` actualizando todas las referencias internas en un solo PR.
- `Navbar` de la landing pasa a server component con dos estados: anónimo y autenticado, con CTAs que navegan a rutas reales.
- Mantener intactas todas las garantías de autorización existentes (`requireSession`, `requireSuperAdmin`, `loadOrgContext`).

**Non-Goals:**

- Aplanar URL a `/[orgSlug]` sin prefijo (descartado: colisiona con rutas top-level y exige reserved-slug list).
- Crear página `/sign-up` separada (queda pendiente hasta que se incorpore email/password).
- Cambiar la lógica de `resolvePostAuthDestination` (solo se ajusta el path que emite).
- Redirects 301 desde rutas `/o/...` legadas (esta change es BREAKING y los enlaces externos a `/o/...` simplemente caerán al 404 de Next).
- Personalizar visualmente sidebar-07 más allá de poblar `items`, `user` y `teams`.

## Decisions

### Decisión 1: Route groups separados `(marketing)` y `(app)`

Crear dos route groups peer-level:

```
app/
├── layout.tsx                  # solo <html><body><children/> + fonts/globals
├── (marketing)/
│   ├── layout.tsx              # monta <Navbar/>
│   └── page.tsx                # landing (movida desde app/page.tsx)
├── (public)/
│   └── sign-in/…               # sin cambios
├── (onboarding)/…              # sin cambios estructurales
├── (app)/
│   ├── layout.tsx              # <SidebarProvider><AppSidebar/><SidebarInset>…
│   ├── org/[orgSlug]/…         # movido desde (app)/o/[orgSlug]
│   └── super-admin/…           # movido desde app/super-admin
├── invitations/[token]/…       # sin cambios
└── post-auth/                  # sin cambios
```

**Por qué:**
- Los route groups no afectan la URL pública (`/super-admin` sigue siendo `/super-admin`).
- Aísla los layouts: la `Navbar` solo carga si la ruta cae bajo `(marketing)/`.
- Separa visualmente "lo público" de "lo autenticado" en el filesystem.

**Alternativa considerada:** Mantener `Navbar` en root layout y condicionar render leyendo `headers()`. Rechazada porque acopla layout a path parsing y deja en pie el doble header durante la transición.

### Decisión 2: Un solo `AppSidebar` adaptativo (no dos sidebars distintos)

`(app)/layout.tsx` monta `<AppSidebar/>`. El propio `AppSidebar` decide qué `teams`, `navMain` y comportamiento mostrar a partir del primer segmento de la URL (vía `usePathname()` en client) o, mejor aún, de props que cada layout hijo pasa.

Forma elegida: el `(app)/layout.tsx` no conoce el contexto; pasa `children` adentro de `<SidebarInset>`. Cada layout hijo (`org/[orgSlug]/layout.tsx`, `super-admin/layout.tsx`) prepara los datos (memberships, items de navegación) y los pasa al `AppSidebar` mediante una API en su `header`/`provider`.

Para evitar acoplar capas, el patrón concreto:

```
(app)/layout.tsx
  └─ <SidebarProvider>
       <AppSidebar variant="adaptive"
                    mode={mode}              # "org" | "super-admin"
                    user={user}              # alimenta NavUser
                    teams={teams}            # solo en mode="org"
                    activeTeamId={…}
                    items={navItems}/>
       <SidebarInset>{children}</SidebarInset>
     </SidebarProvider>
```

`mode`, `user`, `teams`, `items` los resuelve el layout HIJO (org o super-admin) y los pasa a `AppSidebar`. Lo hacemos vía un **layout intermedio** por modo:

- `(app)/org/[orgSlug]/layout.tsx` resuelve `loadOrgContext` + memberships y monta el shell con `mode="org"`.
- `(app)/super-admin/layout.tsx` resuelve `requireSuperAdmin()` y monta el shell con `mode="super-admin"`.

`(app)/layout.tsx` queda como un thin wrapper que solo se asegura de tener sesión (`requireSession()`). El layout hijo decide qué shell monta y con qué datos.

**Por qué un solo `AppSidebar`:**
- sidebar-07 ya viene preparado para recibir items como prop; reusar la pieza evita divergencia visual entre zonas.
- Un super-admin que también es miembro de orgs usa los dos modos en la misma sesión; el switch se siente más natural.

**Alternativa considerada:** `OrgSidebar` y `PlatformSidebar` como dos componentes distintos. Rechazada por duplicar `NavUser` + footer + estilos, sin ganancia clara — la diferencia entre modos es solo qué entradas viven en `NavMain` y si `TeamSwitcher` aparece.

### Decisión 3: `NavUser` en el `SidebarFooter` reemplaza a `UserMenu`

`sidebar-07` instala `nav-user.tsx` con avatar + nombre + email + dropdown (Theme, Settings, Log out). Vamos a:

1. Sustituir las opciones del dropdown por las nuestras: "Cerrar sesión" (acción client que llama `signOut()` del better-auth client) y, si `isSuperAdmin`, un enlace "Plataforma" → `/super-admin`.
2. Borrar `components/app/user-menu.tsx`.
3. La `Cerrar sesión` del `NavUser` reusa la lógica de `components/auth/sign-out-button.tsx` pero embebida como `<DropdownMenuItem>` en lugar de `<Button>`. Vamos a extraer la llamada a `signOut()` en un hook `useSignOut()` o un client component pequeño para no duplicar.

### Decisión 4: `TeamSwitcher` reemplaza a `OrgSwitcher`

`sidebar-07` instala `team-switcher.tsx` que muestra el equipo activo arriba del sidebar con un dropdown para cambiar. Mapeo:

- `team` = `organization` (nombre, slug, logo opcional). Como no tenemos logo, usamos un ícono genérico de phosphor (e.g. `Buildings`).
- `activeTeam` = `currentOrg` de `loadOrgContext`.
- Cambiar de team navega a `/org/{slug}` y deja que better-auth `setActiveOrganization` se actualice en el server action correspondiente (la lógica ya existe en `OrgSwitcher`; la portamos).
- En `mode="super-admin"`, escondemos `TeamSwitcher` y mostramos solo el branding "Notify · Plataforma".

### Decisión 5: `Navbar` server component con subcomponente client para logout

```
components/site/navbar.tsx        ← server component, llama getSession()
  ├─ <Link href="/sign-in"> Iniciar sesión </Link>           # cuando no hay sesión
  └─ <AuthedNavActions>                                       # cuando sí hay sesión
       ├─ <Link href="/post-auth"> Dashboard </Link>
       └─ <SignOutMenuItem/>                                  # client subcomponent
```

`SignOutMenuItem` se aloja en `components/site/sign-out-menu-item.tsx` (o reusamos `components/auth/sign-out-button.tsx` con un `variant="ghost"` y label "Cerrar sesión"). La conversión a server component es directa porque `Navbar` no tenía estado.

### Decisión 6: Rename mecánico con cambio único en `destinationToPath`

El rename `/o/` → `/org/` afecta 11 archivos. El único lugar que **genera** rutas dinámicamente es `lib/auth/routing.ts:70` (`return \`/o/${destination.slug}\`;`). Cambiarlo ahí + un find/replace mecánico sobre los strings hardcoded resuelve todo. No hay base de datos ni cache que invalidar.

Orden de migración para minimizar el período de inconsistencia local:

1. Crear `app/(app)/org/[orgSlug]/` copiando la estructura desde `(app)/o/[orgSlug]/`.
2. Actualizar `destinationToPath`.
3. Actualizar referencias hardcoded.
4. Borrar `(app)/o/`.

Cada paso por separado deja el build verde porque hasta el paso 4 ambos paths existen.

### Decisión 7: Instalación de `sidebar-07` antes de tocar layouts

```bash
cd web
pnpm dlx shadcn@latest add sidebar-07
```

Esto instala:
- `components/ui/sidebar.tsx`, `sheet.tsx`, `tooltip.tsx`, `separator.tsx`, `dropdown-menu.tsx`, `avatar.tsx`, `collapsible.tsx`.
- `components/app-sidebar.tsx`, `nav-main.tsx`, `nav-user.tsx`, `team-switcher.tsx`.
- `hooks/use-mobile.ts`.

Lo movemos a la convención del proyecto: `components/app/app-sidebar.tsx` etc. (la carpeta `components/app` ya existe en el repo).

**Iconos:** sidebar-07 viene con `lucide-react`. Como la convención del proyecto es `@phosphor-icons/react` (ver `components.json`), reemplazamos imports en los archivos generados.

## Risks / Trade-offs

- **[Riesgo] Enlaces externos a `/o/[slug]` (emails de invitación viejos, bookmarks, integraciones) caen al 404.** → Mitigación: aceptado por ser BREAKING en una etapa temprana del producto. Si después se necesita compat, agregar `redirects` en `next.config.ts` es trivial.
- **[Riesgo] Reemplazar `OrgSwitcher` y `UserMenu` arrastra regresiones de comportamiento (server actions, `setActiveOrganization`).** → Mitigación: portar la lógica existente literalmente al nuevo componente; no inventar.
- **[Riesgo] sidebar-07 trae `lucide-react` y duplicamos librería de iconos.** → Mitigación: reemplazar imports a `@phosphor-icons/react` durante la instalación y no agregar `lucide-react` al `package.json`.
- **[Riesgo] El `(app)/layout.tsx` thin requiere que cada hijo monte el shell, lo que puede llevar a divergencias.** → Mitigación: extraer un componente `<AppShell mode user teams items>` que ambos layouts hijos llaman, así el wiring es declarativo y consistente.
- **[Trade-off] El sidebar adaptativo (un componente con `mode`) gana cohesión pero pierde claridad de tipos.** → Aceptado: el espacio de variantes es pequeño (`"org" | "super-admin"`), y discriminated unions en TypeScript hacen explícitas las props requeridas por modo.

## Migration Plan

1. **Instalar sidebar-07** (`pnpm dlx shadcn@latest add sidebar-07` desde `web/`) y normalizar a `@phosphor-icons/react`.
2. **Reestructurar route groups:**
   - Crear `app/(marketing)/layout.tsx` con la `Navbar`.
   - Mover `app/page.tsx` → `app/(marketing)/page.tsx`.
   - Quitar `<Navbar/>` de `app/layout.tsx`.
3. **Crear `(app)` group con shell:**
   - `app/(app)/layout.tsx` (thin: `requireSession()` + `<SidebarProvider>` wrapper opcional).
   - `components/app/app-sidebar.tsx` (adaptativo).
   - `components/app/app-shell.tsx` (helper que cablea provider + sidebar + inset).
4. **Mover super-admin a `(app)`:**
   - Mover `app/super-admin/` → `app/(app)/super-admin/`.
   - Reemplazar header inline por `<AppShell mode="super-admin"/>`.
   - Eliminar `components/app/user-menu.tsx`.
5. **Crear `(app)/org/[orgSlug]/`:**
   - Copiar estructura desde `(app)/o/[orgSlug]/`.
   - Reemplazar `<Topbar/>` por `<AppShell mode="org"/>`.
   - Eliminar `components/app/topbar.tsx` y `components/app/org-switcher.tsx`.
6. **Actualizar `destinationToPath`** en `lib/auth/routing.ts` para emitir `/org/${slug}`.
7. **Find/replace** todas las referencias hardcoded a `/o/${slug}` en los 11 archivos identificados → `/org/${slug}`.
8. **Borrar `app/(app)/o/`**.
9. **Convertir `Navbar` a server component** con `getSession()` y dos estados (anónimo/autenticado).
10. **Smoke test manual**: landing anónimo, landing autenticado, sign-in, onboarding (sin org), creación de org, dashboard `/org/[slug]`, switch de org, super-admin, logout.

**Rollback:** revertir el commit. No hay migraciones de DB ni cambios persistentes.

## Open Questions

- ¿La acción "Cerrar sesión" debe vivir en `NavUser` (dropdown del sidebar) Y en `Navbar` (cuando un usuario autenticado abre la landing), o solo en `NavUser`? Decisión por defecto: ambas, porque un usuario autenticado puede aterrizar en la landing y querer cerrar sesión sin entrar al dashboard.
- ¿`TeamSwitcher` necesita el botón "Crear organización" en su dropdown (sidebar-07 lo trae por defecto como "Add team")? Decisión por defecto: sí, navega a `/onboarding/new-org`.

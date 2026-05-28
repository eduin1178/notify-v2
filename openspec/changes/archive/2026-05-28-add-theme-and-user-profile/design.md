## Context

Notify es una app Next.js 16 (App Router, React 19) con Tailwind v4 (CSS-first via `@theme` en `web/app/globals.css`), shadcn/ui con icon set `@phosphor-icons/react`, y better-auth con plugins `organization` y `admin`. El shell autenticado vive bajo el route group `(app)/` con `AppSidebar` y `NavUser` (ver `openspec/specs/app-shell/spec.md`). Hoy `NavUser` solo expone "Plataforma" (cuando aplica) y "Cerrar sesión"; no hay control de tema en ninguna superficie, y no existe `/account`.

Tailwind v4 ya activa modo oscuro por la presencia de la clase `dark` en un ancestro (estrategia por defecto del paquete). Better-auth expone en cliente `signIn.social`, `linkSocial`, `unlinkAccount`, `listAccounts`, y vía plugin `organization` expone `listOrganizations`, `leaveOrganization`, `acceptInvitation`, `rejectInvitation`. Las invitaciones se persisten en `schema.invitation` con campo `email` y `status`.

## Goals / Non-Goals

**Goals:**
- Tema persistente (claro/oscuro/sistema) sin flash en hidratación, sin librería externa.
- Toggle disponible en landing (footer), `/sign-in`, y `NavUser` del shell autenticado.
- Página `/account` única, dentro del shell `(app)/`, robusta al estado "sin organización activa".
- Gestión de providers OAuth (Google/GitHub) desde `/account` reusando better-auth.
- Lista de organizaciones del usuario con rol y opción de salir, delegando la regla "único owner" al backend.
- Lista de invitaciones recibidas por email con acciones de aceptar/rechazar en estado `pending` e historial colapsable.

**Non-Goals:**
- Edición de datos de usuario (name, avatar) en v1.
- Soporte de email/password u otros providers.
- Notificaciones en tiempo real de invitaciones nuevas.
- Re-sincronización manual con el provider.
- Migraciones de base de datos.

## Decisions

### Decisión 1 — Implementación propia del tema (sin `next-themes`)

**Qué:** un módulo `web/lib/theme/` con tres piezas:
1. `cookie.ts` — server helpers para leer/escribir cookie `notify-theme` con valores `light | dark | system`.
2. `script.ts` — string con el script inline anti-flash que se inyecta en `<head>` antes de hidratar.
3. `theme-toggle.tsx` — componente cliente (dropdown shadcn) que muta el `class` de `<html>` y persiste la cookie vía server action.

**Por qué:** el usuario ya tuvo problemas con `next-themes` en otro proyecto. Una solución a medida nos da control total del lifecycle (cookie HTTP-only, sin `localStorage`, compatible con RSC). El costo es ~80 líneas de código bien acotadas.

**Alternativas consideradas:**
- `next-themes`: descartado por la experiencia previa reportada.
- Solo `localStorage`: descartado porque el servidor no puede saber el tema al renderizar la primera respuesta, generando flash.

**Detalle del anti-flash:**
```html
<script>
  (function () {
    try {
      var cookie = document.cookie.match(/(?:^|; )notify-theme=([^;]+)/);
      var stored = cookie ? cookie[1] : 'system';
      var mql = window.matchMedia('(prefers-color-scheme: dark)');
      var resolved = stored === 'system' ? (mql.matches ? 'dark' : 'light') : stored;
      document.documentElement.classList.toggle('dark', resolved === 'dark');
      document.documentElement.dataset.theme = stored;
    } catch (_) {}
  })();
</script>
```
Se inyecta vía `dangerouslySetInnerHTML` en `app/layout.tsx` dentro de `<head>` (Next 16 lo permite). El root sigue siendo server; el script corre antes de cualquier paint.

**Persistencia:**
- Cookie `notify-theme` HTTP-only **no**, debe ser legible por el script anti-flash → cookie **no HTTP-only**, `SameSite=Lax`, `Path=/`, `Max-Age=1 año`. La cookie no porta secretos.
- Se escribe vía server action invocada desde `theme-toggle.tsx`.

**Sistema como default:** si la cookie no existe, el script resuelve `system` → `prefers-color-scheme`. El estado mostrado en el toggle es "Sistema" hasta que el usuario elija explícitamente.

### Decisión 2 — Ubicación de `/account`: dentro de `(app)/`

**Qué:** `/account` es una ruta de primer nivel bajo `(app)/`, no anidada bajo `/org/[slug]`. Su layout local no resuelve `loadOrgContext`. El `AppSidebar` recibe un nuevo modo o flag para esta ruta.

**Por qué:** estandariza con productos como Vercel/Linear/Stripe donde "Account" vive fuera del contexto de workspace pero comparte el shell. Reutiliza `AppSidebar`, `NavUser` y el guard de sesión del layout `(app)/layout.tsx`.

**Adaptación del shell:** introducir un tercer modo en `AppSidebar`: `mode: "org" | "super-admin" | "account"`. En modo `account`:
- Si el usuario tiene memberships: muestra `TeamSwitcher` (con la primera org como activa visual) y el item "Mi cuenta" resaltado.
- Si el usuario NO tiene memberships: oculta `TeamSwitcher` y muestra en su lugar un CTA "Crear organización" que navega a `/onboarding/new-org`.
- `NavUser` siempre presente en el footer.

**Alternativas consideradas:**
- Layout propio sin sidebar: descartado, rompe consistencia visual y obliga a duplicar header/menú.
- Anidar bajo `/org/[slug]/account`: descartado, el perfil es del usuario, no de la org.

### Decisión 3 — Datos de la sección "Conexiones": cliente, no server

**Qué:** la sección de conexiones es un componente cliente que invoca `authClient.listAccounts()` al montar y refresca tras `linkSocial` / `unlinkAccount`. No hay server action intermedia.

**Por qué:** `linkSocial` redirige al provider y vuelve; mantener la operación en cliente evita una capa innecesaria. `listAccounts` ya devuelve la lista filtrada por sesión.

**Regla del último provider (delegada al backend):**
- El frontend NO precomputa "es el último" para deshabilitar el botón.
- Al invocar `unlinkAccount`, si el backend devuelve error (better-auth ya implementa esta regla), el frontend muestra un toast/mensaje: "No puedes desvincular tu único proveedor de acceso."
- Esto cumple lo pedido por el usuario (D4): la decisión vive solo en backend.

**Riesgo conocido:** better-auth puede no traer esta regla por defecto. Mitigación: si la verificación muestra que no la trae, añadir un check pre-`unlink` en una server action propia (`/account/unlink`) que cuente accounts del usuario y rechace si `count === 1`.

### Decisión 4 — Listado de invitaciones del usuario por email

**Qué:** una server action / route handler `loadAccountInvitations()` que:
1. Lee `session.user.email`.
2. Query a `schema.invitation` `WHERE email = userEmail` con join a `organization` (para nombre y slug) y al `inviter` (para nombre).
3. Particiona el resultado en `pending` y `closed` (status ∈ {accepted, rejected, canceled, expired}).
4. Limita `closed` a las últimas N (N=20) ordenadas por `expiresAt` desc.

**Por qué:** el plugin `organization` expone `listInvitations` por org, no por usuario. Acceso directo al schema es lo más simple.

**Acciones:** `acceptInvitation({ invitationId })` y `rejectInvitation({ invitationId })` del cliente better-auth. Tras éxito, refrescar la lista.

### Decisión 5 — Salir de una organización

**Qué:** botón "Salir" invoca `organization.leaveOrganization({ organizationId })` desde cliente.

**Regla "único owner":** delegada al backend del plugin `organization`. Si el plugin no la implementa nativamente, envolver en una server action `/account/organizations/leave` que cuente owners de la org antes de invocar.

**UX:** confirmación con `AlertDialog` antes de ejecutar; toast de éxito o error según resultado.

### Decisión 6 — Footer de la landing

**Qué:** nuevo `web/components/site/footer.tsx` server component, montado en `web/app/(marketing)/layout.tsx`. Contiene:
- Marca "Notify" y copyright.
- `ThemeToggle` (client) a la derecha.

Minimal por ahora; no se mete legales ni navegación secundaria — el spec lo deja abierto a v2.

### Decisión 7 — Entrada "Mi cuenta" en `NavUser`

**Qué:** insertar un item "Mi cuenta" en el dropdown de `NavUser`, **antes** del separador que precede a "Cerrar sesión" y **después** del item "Plataforma" si existe. Navega a `/account`.

## Risks / Trade-offs

- **[Riesgo]** Anti-flash script inline puede ser bloqueado por CSP estrictas → **Mitigación:** documentar la necesidad de `script-src 'unsafe-inline'` o reemplazar por hash; hoy no hay CSP configurada.
- **[Riesgo]** `better-auth` no implementa nativamente "impedir desvincular último provider" o "impedir salir si único owner" → **Mitigación:** server actions propias con validación. Validar en la fase de verify.
- **[Trade-off]** Cookie de tema no HTTP-only → necesario para anti-flash. No porta secretos, riesgo aceptable.
- **[Trade-off]** Implementación propia del tema vs. librería = más control, más superficie a mantener (~80 LOC).
- **[Riesgo]** Tokens semánticos del `@theme` en `globals.css` pueden no tener variante `dark` → **Mitigación:** auditar `globals.css` y añadir `@theme.dark` o reglas `.dark { --foo: ... }` necesarias antes de exponer el toggle.
- **[Riesgo]** `AppSidebar` con tercer modo aumenta complejidad → **Mitigación:** mantener la rama `account` minimalista (sin nav items de org si no hay memberships).

## Migration Plan

No hay migración de datos. Despliegue directo. Rollback: revertir el merge.

## Open Questions

- ¿Queremos un atajo de teclado para el toggle de tema (p.ej. `g + t`)? — fuera de scope v1, anotado para futuro.
- ¿El historial de invitaciones se pagina o se limita a últimas 20? — decidido N=20 sin paginación en v1.

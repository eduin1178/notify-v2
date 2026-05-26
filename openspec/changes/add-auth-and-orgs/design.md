## Context

El proyecto es Next.js 16 (App Router, React 19) sobre Vercel, sin DB ni autenticación. Esta change introduce simultáneamente la primera capa de persistencia (Drizzle + Neon Postgres), la primera capa de identidad (better-auth con OAuth) y el modelo multi-tenant (organizaciones con roles). Como es greenfield, las decisiones aquí pesan más que en cambios incrementales: cualquier feature posterior asumirá esta base.

Stakeholders: el operador del SaaS (rol SuperAdmin, persona única), los dueños de organización (Owner, generan revenue), administradores delegados (Admin), y miembros consumidores (Member).

Restricciones clave:
- Vercel serverless ⇒ conexiones DB cortas y pooled (driver `@neondatabase/serverless` o HTTP).
- Edge runtime no es compatible con el adapter Node de better-auth para todas las features; las rutas de auth corren en Node runtime.
- Account linking depende de email verificado por el OAuth provider; Google y GitHub siempre lo verifican, así que es seguro confiarlo.

## Goals / Non-Goals

**Goals:**
- Login social con Google y GitHub, sin email/password.
- Una sola cuenta de usuario por email verificado, sin importar el provider que usó primero.
- Modelo multi-tenant donde un usuario puede pertenecer a varias organizaciones con un rol por organización.
- Onboarding determinista: el usuario nuevo nunca queda "huérfano" sin org.
- Rol SuperAdmin global, fuera del modelo de orgs, bootstrapeable sin UI mediante variable de entorno.
- Invitaciones por email vía Resend + link copiable, con TTL.
- Toda la configuración de schema y migraciones gestionada por Drizzle, reproducible en local y prod.

**Non-Goals:**
- Email + password, magic links, passkeys, o cualquier otro método de auth. Solo OAuth Google/GitHub.
- SSO empresarial (SAML, OIDC custom).
- 2FA / MFA. Lo dejamos para una change posterior.
- API keys o tokens programáticos por org.
- Billing, planes, límites por org.
- Auditoría completa de acciones (audit log). Solo registramos lo mínimo para invitaciones aceptadas/expiradas.
- Soft delete o recuperación de orgs eliminadas.
- Internacionalización del flujo (todo el copy es Spanish neutral por convención del proyecto).

## Decisions

### Decision 1: better-auth con plugins `organization` y `admin`

**Elección**: `better-auth` con `socialProviders: { google, github }`, plugin `organization` para multi-tenancy, plugin `admin` para el rol global de plataforma.

**Por qué**:
- TypeScript first, schema generado y migrable con Drizzle.
- Los plugins `organization` y `admin` ya resuelven el 80% de lo que necesitamos (miembros, roles, invitaciones con TTL, transferencia de ownership, bootstrap de admin).
- Composable: ambos plugins coexisten sin conflicto y exponen handlers Next-friendly.

**Alternativas consideradas**:
- **Auth.js / NextAuth**: maduro, pero el modelo de organizaciones es DIY. Habría que escribir tablas, helpers, invitaciones, y políticas de roles. Más superficie de bugs.
- **Clerk**: managed, excelente DX, pero precio por MAU y dependencia de un proveedor externo para identidad. Para un SaaS donde queremos ownership total y costo predecible, no compensa.
- **Lucia**: minimalista, requiere construir todo encima. Demasiado bajo nivel para este alcance.

### Decision 2: Drizzle ORM sobre Neon Postgres

**Elección**: `drizzle-orm` + `drizzle-kit` + driver `@neondatabase/serverless` (HTTP fetch) para Vercel.

**Por qué**:
- Drizzle se integra nativamente con el adapter de better-auth (`drizzleAdapter`).
- Migraciones declarativas desde el schema TS (`drizzle-kit generate` / `migrate`).
- Neon serverless driver evita problemas de pool en Vercel functions.
- Costo Neon tier gratuito alcanza para desarrollo y primeros usuarios.

**Alternativas consideradas**:
- **Prisma + Neon**: Prisma genera un cliente pesado y su workflow de migraciones es menos directo. Sobrepasa lo que necesitamos.
- **Kysely**: query builder excelente pero requiere migraciones a mano. Más fricción.
- **Supabase**: incluye auth propia que entraría en conflicto con better-auth. Si solo usamos su Postgres, Neon es más simple.

### Decision 3: SuperAdmin como flag global, no como rol de organización

**Elección**: el rol SuperAdmin vive en la tabla `user` (campo `role: 'admin' | 'user'` del plugin `admin` de better-auth, o `isSuperAdmin: boolean` si simplificamos). NO es un miembro de ninguna organización en virtud de su SuperAdmin-ness; puede o no tener memberships separadas.

**Por qué**:
- Conceptualmente diferente: SuperAdmin actúa sobre la plataforma (ve todas las orgs, suspende cuentas), no sobre una org específica.
- Tener un cuarto rol dentro de la jerarquía de org (donde Owner ya es techo) sería redundante y confuso.
- El plugin `admin` de better-auth ya implementa este patrón exacto.

**Alternativas consideradas**:
- **SuperAdmin como cuarto rol de org**: descartado en exploración por ser anti-pattern.
- **Tabla separada `platform_admins`**: más limpio conceptualmente pero duplica lo que better-auth ya ofrece.

### Decision 4: Bootstrap del primer SuperAdmin por variable de entorno

**Elección**: `SUPER_ADMIN_EMAIL` en env. En el callback de sign-in/sign-up, si `user.email === SUPER_ADMIN_EMAIL && user.emailVerified`, marcar `role = 'admin'`. Idempotente: re-aplicar en cada login no hace daño.

**Por qué**:
- No requiere UI ni script manual.
- Funciona en cualquier entorno (dev, preview, prod) cambiando la variable.
- Es seguro porque OAuth siempre devuelve email verificado de Google y GitHub.

**Alternativas consideradas**:
- **Script de seed**: requiere ejecutar manualmente en prod, fácil de olvidar.
- **Endpoint privado con token**: más complejo, una superficie de ataque más.
- **CLI dedicado**: overkill para una operación que ocurre una vez por entorno.

### Decision 5: Account linking automático por email verificado

**Elección**: configurar better-auth con `account.accountLinking.enabled = true` y `trustedProviders: ['google', 'github']`. Mismo email verificado entre providers ⇒ misma fila `user`, dos filas `account`.

**Por qué**:
- Google y GitHub siempre verifican el email; el riesgo de account takeover por email no verificado es nulo.
- Mejor UX: el usuario nunca tiene "dos cuentas" porque hizo login con providers distintos en días distintos.

**Riesgo**: si más adelante agregamos un provider que no verifique email (improbable), habrá que sacarlo de `trustedProviders`.

### Decision 6: Onboarding forzado a crear org cuando no hay invitación

**Elección**: tras OAuth exitoso, el callback chequea:
1. ¿Hay invitaciones pendientes para `user.email`? Si sí → mostrar pantalla de aceptación. El usuario puede aceptar una o varias, o seguir y crear su propia org.
2. Si no hay invitaciones y el usuario no tiene memberships → redirect a `/onboarding/new-org`, formulario simple (nombre de la org), crea org + membership(role=Owner).
3. Si ya tiene memberships → redirect a la última org activa.

**Por qué**:
- Modelo Notion/Linear: ningún usuario queda en limbo. La org se crea siempre, incluso si va a ser solo para él.
- Evita estados ambiguos en la UI (qué mostrar a un usuario sin org).

**Alternativas consideradas**:
- **Limbo opcional**: complica la UI y requiere una pantalla "estás esperando invitación".
- **Crear org default invisible**: introduce orgs fantasma en la DB, mala UX si después quiere renombrarla.

### Decision 7: Organización activa en la sesión (no en cada request por param)

**Elección**: la org activa se persiste en la sesión de better-auth (campo `activeOrganizationId` que el plugin `organization` ya soporta). El selector de org en la UI llama a `auth.organization.setActive({ organizationId })` y refresca la cookie.

**Por qué**:
- Una sola fuente de verdad para "qué org estoy viendo".
- Server components leen la sesión y derivan la org sin tener que parsear URLs.
- Si la URL incluye el org slug (`/o/[slug]/...`) y no coincide con la sesión, el server hace `setActive` y redirige; nunca hay disonancia.

**Alternativas consideradas**:
- **Org por subpath en URL** sin estado de sesión: requiere que cada query DB reciba el slug; más fricción y propenso a olvidos.
- **Subdominio por org**: bonito pero requiere wildcard DNS, cookies por subdominio, y complica preview deployments de Vercel.

### Decision 8: Invitaciones por email + link copiable

**Elección**: al crear invitación, generar `token` opaco, persistir `(email, role, organizationId, token, expiresAt)`. Enviar email vía Resend con el link `/invitations/[token]`. Mostrar el mismo link copiable en la UI de gestión de miembros.

**Cruce de email**: al aceptar la invitación, exigir que el usuario esté autenticado y que el email autenticado coincida con el de la invitación (case-insensitive, trimmed). Si no coincide, mostrar error claro.

**TTL**: 7 días por defecto, configurable vía constante. Invitaciones expiradas se pueden re-enviar (genera nuevo token).

**Por qué**:
- Email es necesario para que la invitación llegue cuando el invitado no está conectado.
- Link copiable cubre los casos donde el email se pierda en spam o se quiera invitar a alguien en el mismo equipo cara a cara.
- Cruzar el email evita que alguien que conozca un token pero no controle el email lo use.

### Decision 9: Permisos por rol — tabla canónica

| Acción | SuperAdmin | Owner | Admin | Member |
|---|:---:|:---:|:---:|:---:|
| Ver panel `/super-admin` | ✅ | — | — | — |
| Listar todas las orgs | ✅ | — | — | — |
| Suspender usuarios / impersonar | ✅ | — | — | — |
| Crear nueva org (la propia) | ✅ | ✅ | ✅ | ✅ |
| Eliminar org | ✅ | ✅ | — | — |
| Transferir ownership | ✅ | ✅ | — | — |
| Editar settings de org | ✅ | ✅ | ✅ | — |
| Ver lista de miembros | ✅ | ✅ | ✅ | ✅ |
| Invitar miembros | ✅ | ✅ | ✅ | — |
| Cambiar rol de un Member | ✅ | ✅ | ✅ | — |
| Cambiar rol de un Admin | ✅ | ✅ | — | — |
| Cambiar rol de Owner | ✅ | — | — | — |
| Remover Member | ✅ | ✅ | ✅ | — |
| Remover Admin | ✅ | ✅ | — | — |
| Remover Owner | ✅ | — | — | — |
| Salir de la org | — | ⚠ (solo si hay otro Owner) | ✅ | ✅ |
| Ver contenido de la org | ✅ | ✅ | ✅ | ✅ |

Las reglas se centralizan en un helper `web/lib/auth/permissions.ts` (`can(user, action, context)`), nunca en componentes.

### Decision 10: Resend para email, con fallback de link copiable siempre visible

**Elección**: cliente Resend único en `web/lib/email/resend.ts`. Si el envío falla (red, rate limit, dominio no verificado), la invitación queda persistida igual y el link copiable sigue siendo válido. Loggear el error sin romper el flujo de creación.

**Por qué**: el link copiable es el "plan B" natural y permite que el producto funcione incluso si Resend está caído.

## Risks / Trade-offs

- **[Conexiones DB en Vercel functions]** → usar `@neondatabase/serverless` (HTTP) en producción; pgBouncer no requerido. En dev local, conexión TCP estándar.
- **[Account linking inseguro si en el futuro agregamos un provider sin verificar email]** → política: cualquier nuevo provider entra a `trustedProviders` solo después de auditar que el email vuelve verificado. Documentado en `lib/auth/index.ts`.
- **[Owner único que se va]** → la UI bloquea "salir de la org" para el último Owner; debe transferir ownership primero o eliminar la org.
- **[Resend cae o el dominio no está verificado todavía]** → invitaciones persisten igual, link copiable mostrado en UI, retry manual posible (re-enviar). El feature de invitar no depende fuertemente de Resend.
- **[SUPER_ADMIN_EMAIL cambiado en prod por accidente]** → no degrada usuarios existentes (el flag ya está en DB); pero el siguiente login del nuevo email se vuelve admin. Mitigación: la variable está en Vercel Project Settings con scope `Production`, cambiarla requiere acceso de owner del proyecto.
- **[Sesiones largas y revocación]** → better-auth usa cookies firmadas con secret. Rotar `BETTER_AUTH_SECRET` invalida todas las sesiones; documentar como procedimiento de emergencia.
- **[OAuth callback URLs en preview deployments de Vercel]** → cada preview URL es distinta y los OAuth providers exigen URLs registradas. Mitigación: registrar `https://*.vercel.app` no se permite en Google; en su lugar registrar la URL de preview principal y usarla como `BETTER_AUTH_URL` consistentemente, o limitar OAuth a `localhost` + `production` durante esta fase y testear preview con un usuario sintético.
- **[Migraciones rotas en prod]** → política: nunca aplicar `drizzle-kit push` en prod. Solo `drizzle-kit generate` + `drizzle-kit migrate` corrido en CI, con migraciones commiteadas.

## Migration Plan

No hay datos previos. La estrategia es bootstrap inicial:

1. Provisionar Neon project, capturar `DATABASE_URL`.
2. Crear OAuth apps (Google Cloud, GitHub Developer Settings) con callback `${BETTER_AUTH_URL}/api/auth/callback/{provider}` para dev (`http://localhost:3000`) y prod.
3. Verificar dominio en Resend, capturar `RESEND_API_KEY` y `RESEND_FROM_EMAIL`.
4. Setear todas las env vars en `.env.local` y en Vercel.
5. `pnpm install` de las nuevas deps, generar y aplicar primera migración.
6. Deploy a producción. Login con `SUPER_ADMIN_EMAIL` ⇒ bootstrap automático.

**Rollback**: si el deploy fracasa, revertir el merge en main, Vercel hace rollback al deploy anterior. La DB queda con las tablas vacías; no hay impacto en usuarios porque aún no hay tráfico real.

## Open Questions

- **Slug de organización**: ¿generamos slug a partir del nombre (con dedupe `acme`, `acme-2`)? ¿Lo hacemos editable por Owner? Decisión sugerida: generación automática inicial, edición permitida en settings — pero lo definimos en specs.
- **Email "from" en producción**: ¿usamos `noreply@<dominio>` o un alias más cálido? Depende del dominio que use Edunet.
- **TTL de invitación**: 7 días confirmado como default, pero ¿editable por Owner en settings? Lo dejamos fijo en esta change y se revisa después.
- **Avatar del usuario**: better-auth recibe `image` del OAuth provider. ¿Lo mostramos en el header? Trivial pero confirmemos en la spec del menú de usuario.
- **Selector de org**: ¿dropdown en topbar (modelo Linear) o página dedicada `/orgs` (modelo GitHub)? Sugerido: dropdown + atajo a página `/orgs` para gestión completa.

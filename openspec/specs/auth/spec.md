## Purpose

Define cómo los usuarios se autentican y mantienen sesión en Notify. Cubre el inicio de sesión social (Google y GitHub), la vinculación automática de cuentas que comparten un email verificado, la gestión de sesiones mediante cookie firmada y la promoción automática del rol global SuperAdmin a partir de una variable de entorno. Es explícitamente exclusiva: no existe ningún otro mecanismo de autenticación.

## Requirements

### Requirement: Inicio de sesión social con Google y GitHub

El sistema SHALL permitir a un usuario autenticarse exclusivamente mediante OAuth con Google o con GitHub. El sistema MUST NOT exponer ningún flujo de email/password, magic link, ni passkey.

#### Scenario: Login exitoso con Google
- **WHEN** un visitante hace clic en "Continuar con Google" en `/sign-in` y completa el consentimiento de Google
- **THEN** el sistema crea o recupera la cuenta del usuario, establece una sesión y lo redirige al flujo de onboarding o a su organización activa

#### Scenario: Login exitoso con GitHub
- **WHEN** un visitante hace clic en "Continuar con GitHub" en `/sign-in` y completa el consentimiento de GitHub
- **THEN** el sistema crea o recupera la cuenta del usuario, establece una sesión y lo redirige al flujo de onboarding o a su organización activa

#### Scenario: El usuario cancela el consentimiento OAuth
- **WHEN** el usuario cancela el consentimiento en Google o GitHub
- **THEN** el sistema lo redirige a `/sign-in` con un mensaje neutro indicando que el inicio de sesión no se completó

#### Scenario: No existe formulario de email/password
- **WHEN** un visitante navega a cualquier ruta pública de autenticación
- **THEN** la UI NO MUST presentar campos de email o contraseña ni enlaces para registrarse con email

### Requirement: Account linking automático por email verificado

El sistema SHALL tratar como la misma cuenta de usuario a dos inicios de sesión de providers distintos cuando ambos proveen el mismo email y ese email viene marcado como verificado por el provider. Google y GitHub MUST estar configurados como trusted providers a estos efectos.

#### Scenario: Usuario inicia con Google y luego con GitHub usando el mismo email
- **WHEN** un usuario inicia sesión con Google (email `x@x.com` verificado) y posteriormente inicia sesión con GitHub usando el mismo email verificado
- **THEN** el sistema vincula la cuenta de GitHub a la misma fila de usuario y la sesión activa apunta a esa cuenta única

#### Scenario: Emails distintos no se vinculan
- **WHEN** un usuario inicia sesión con Google (`a@x.com`) y luego con GitHub (`b@x.com`)
- **THEN** el sistema crea dos cuentas de usuario independientes

### Requirement: Sesión gestionada por cookie firmada

El sistema SHALL persistir la sesión del usuario mediante una cookie HTTP-only firmada con `BETTER_AUTH_SECRET`. La sesión MUST incluir el identificador de usuario y el identificador de organización activa cuando exista. El destino post-autenticación calculado para un usuario con membership activa MUST emitir el path `/org/{slug}` (no `/o/{slug}`).

#### Scenario: Acceso a ruta protegida sin sesión
- **WHEN** un visitante sin sesión navega a una ruta protegida
- **THEN** el sistema lo redirige a `/sign-in` preservando la URL destino en un parámetro `redirect`

#### Scenario: Logout
- **WHEN** un usuario autenticado activa "Cerrar sesión" desde el `NavUser` del sidebar o desde la `Navbar` de marketing
- **THEN** el sistema invalida la sesión, borra la cookie y redirige a `/`

#### Scenario: Destino post-autenticación para usuario con organización

- **WHEN** un usuario autenticado con al menos una membership activa es resuelto por `resolvePostAuthDestination`
- **THEN** `destinationToPath` MUST emitir un path con el prefijo `/org/` (e.g. `/org/acme`)
- **AND** NO MUST emitir ningún path con el prefijo `/o/`

### Requirement: Promoción automática del SuperAdmin desde variable de entorno

El sistema SHALL otorgar el rol global de SuperAdmin al usuario cuyo email autenticado y verificado coincida con la variable de entorno `SUPER_ADMIN_EMAIL`. La promoción MUST ser idempotente y aplicarse en cada inicio de sesión exitoso.

#### Scenario: Primer login del email designado como SuperAdmin
- **WHEN** un usuario hace login con OAuth y su email verificado coincide (case-insensitive, trimmed) con `SUPER_ADMIN_EMAIL`
- **THEN** el sistema actualiza el rol global del usuario a `admin` antes de redirigirlo

#### Scenario: Login subsecuente del SuperAdmin
- **WHEN** un usuario que ya tiene rol SuperAdmin vuelve a iniciar sesión
- **THEN** el sistema NO MUST degradar su rol y MUST mantener `admin` sin error

#### Scenario: Login de un usuario que no es el SuperAdmin
- **WHEN** un usuario con un email distinto a `SUPER_ADMIN_EMAIL` inicia sesión
- **THEN** el sistema NO MUST otorgarle el rol SuperAdmin

#### Scenario: La variable de entorno no está definida
- **WHEN** `SUPER_ADMIN_EMAIL` está vacía o ausente
- **THEN** el sistema MUST iniciar sesión normalmente sin promover a nadie a SuperAdmin

### Requirement: Vinculación manual de providers desde `/account`

El sistema SHALL permitir a un usuario autenticado vincular manualmente un provider OAuth (Google o GitHub) a su cuenta desde la página `/account`. La vinculación MUST reutilizar el flujo OAuth del provider y MUST asociar la cuenta resultante al `userId` de la sesión activa.

#### Scenario: Vincular GitHub a un usuario que solo tiene Google

- **WHEN** un usuario con sesión activa y solo Google vinculado activa "Vincular" sobre GitHub en `/account` y completa el consentimiento
- **THEN** el sistema crea una fila en `account` para GitHub asociada al mismo `userId`
- **AND** al volver a `/account` la UI refleja GitHub como vinculado

#### Scenario: Vinculación con email distinto

- **WHEN** un usuario vincula manualmente un provider cuyo email es distinto al de su cuenta
- **THEN** el sistema asocia el `account` al `userId` actual igualmente (la vinculación manual confía en la sesión activa, no en el email)

#### Scenario: Provider ya vinculado

- **WHEN** un usuario intenta vincular un provider que ya tiene vinculado
- **THEN** la UI NO MUST exponer el botón "Vincular" para ese provider

### Requirement: Desvinculación de providers con regla del último provider

El sistema SHALL permitir a un usuario autenticado desvincular un provider OAuth desde la página `/account`, EXCEPTO cuando ese provider sea el único vinculado a la cuenta. La regla "no puedes quedarte sin ningún provider" MUST aplicarse en el backend; el frontend MUST limitarse a invocar la operación y mostrar el error devuelto.

#### Scenario: Desvincular un provider cuando hay más de uno

- **WHEN** un usuario con Google y GitHub vinculados activa "Desvincular" sobre GitHub
- **THEN** el sistema elimina la fila de `account` correspondiente a GitHub
- **AND** la UI refleja GitHub como no vinculado

#### Scenario: Intento de desvincular el último provider

- **WHEN** un usuario con un único provider vinculado activa "Desvincular" sobre ese provider
- **THEN** el backend rechaza la operación con un error específico
- **AND** la fila en `account` no se elimina
- **AND** el frontend muestra el mensaje "No puedes desvincular tu único proveedor de acceso."

#### Scenario: Frontend no precomputa la regla

- **WHEN** la UI de `/account` se renderiza con un único provider vinculado
- **THEN** el botón "Desvincular" sigue presente y habilitado
- **AND** la decisión de rechazo ocurre al invocar la operación, no antes

### Requirement: Autenticación en rutas REST

El sistema SHALL aplicar la sesión de `better-auth` a las rutas REST bajo `/api/v1/`. El middleware de autenticación MUST resolver la sesión llamando a `auth.api.getSession({ headers })` pasándole los headers crudos de la request entrante, y MUST aceptar transparentemente cualquier mecanismo soportado por better-auth (hoy: cookie HttpOnly firmada; en el futuro: bearer token a través del plugin que se active para Expo).

#### Scenario: Cookie válida en request REST
- **WHEN** un cliente con cookie de sesión válida envía una request a una ruta `/api/v1/...` protegida
- **THEN** el middleware MUST inyectar `session` y `user` en el contexto Hono y el handler MUST ejecutarse

#### Scenario: Sin credenciales en ruta protegida
- **WHEN** un cliente sin cookie ni Authorization válido envía una request a una ruta `/api/v1/...` protegida
- **THEN** la respuesta MUST ser 401 con cuerpo `{ "error": { "code": "unauthorized", "message": <string> } }`

#### Scenario: Cookie expirada o inválida
- **WHEN** un cliente envía una cookie de sesión expirada o con firma inválida
- **THEN** `auth.api.getSession` MUST devolver sesión nula y el middleware MUST responder 401 con `code: "unauthorized"`

### Requirement: Autorización por membresía de organización en path

Las rutas REST de la forma `/api/v1/orgs/:orgId/...` MUST aplicar un middleware que verifique que el usuario autenticado es miembro de la organización identificada por `:orgId`. La membresía MUST consultarse en la tabla `member` del esquema de `better-auth`. El sistema MUST NO usar la "organización activa" en sesión como sustituto del path: la organización del path es la fuente única de verdad.

#### Scenario: Miembro accede a su organización
- **WHEN** un usuario autenticado miembro de la organización `X` envía una request a `/api/v1/orgs/X/...`
- **THEN** el middleware MUST inyectar la organización resuelta en el contexto y el handler MUST ejecutarse

#### Scenario: Usuario autenticado pero no miembro
- **WHEN** un usuario autenticado NO miembro de la organización `Y` envía una request a `/api/v1/orgs/Y/...`
- **THEN** la respuesta MUST ser 403 con `error.code: "forbidden"`

#### Scenario: Organización inexistente
- **WHEN** un usuario autenticado envía una request a `/api/v1/orgs/<id-inexistente>/...`
- **THEN** la respuesta MUST ser 404 con `error.code: "not_found"`

#### Scenario: Organización activa en cookie no influye en REST
- **WHEN** un usuario miembro de `A` y `B` con organización activa `B` en cookie envía `GET /api/v1/orgs/A/...`
- **THEN** el middleware MUST resolver y autorizar contra `A` (ignorando la organización activa de la sesión)

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

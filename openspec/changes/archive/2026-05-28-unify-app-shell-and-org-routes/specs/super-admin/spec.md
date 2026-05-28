## MODIFIED Requirements

### Requirement: Panel de administración de plataforma

El sistema SHALL exponer una ruta `/super-admin` accesible exclusivamente para usuarios con rol SuperAdmin. La ruta MUST listar todas las organizaciones y todos los usuarios de la plataforma con capacidad de inspección. El panel MUST renderizarse dentro del shell unificado `(app)/` usando el `AppSidebar` en `mode="super-admin"`; NO MUST tener un header propio inline ni un menú de usuario separado.

#### Scenario: Acceso autorizado al panel

- **WHEN** un SuperAdmin navega a `/super-admin`
- **THEN** el sistema renderiza el panel dentro del shell `(app)/` con `AppSidebar` en modo super-admin
- **AND** el sidebar muestra las entradas "Organizaciones" y "Usuarios"
- **AND** el sidebar ofrece "Volver a la app" que navega a `/post-auth`

#### Scenario: Acceso no autorizado al panel

- **WHEN** un usuario que no es SuperAdmin navega a `/super-admin`
- **THEN** el sistema MUST responder con 404 o 403 sin revelar la existencia del panel y NO MUST exponer datos de plataforma

#### Scenario: Acceso sin sesión

- **WHEN** un visitante sin sesión navega a `/super-admin`
- **THEN** el sistema lo redirige a `/sign-in`

#### Scenario: La URL pública no cambia

- **WHEN** se accede al panel desde cualquier enlace o redirect
- **THEN** la URL pública sigue siendo `/super-admin` (el route group `(app)` no afecta el path)

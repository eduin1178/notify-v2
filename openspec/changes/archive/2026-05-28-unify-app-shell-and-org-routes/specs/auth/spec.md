## MODIFIED Requirements

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

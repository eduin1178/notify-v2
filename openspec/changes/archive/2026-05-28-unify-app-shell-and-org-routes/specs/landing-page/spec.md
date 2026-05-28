## MODIFIED Requirements

### Requirement: Sticky top navigation bar

El sistema SHALL renderizar una barra de navegación superior que permanece visible al hacer scroll. La `Navbar` MUST vivir exclusivamente dentro del route group `(marketing)/` y MUST NOT renderizarse en el root `app/layout.tsx` ni en áreas autenticadas (`(app)/`).

#### Scenario: Initial render

- **WHEN** la landing page se renderiza
- **THEN** la `Navbar` se posiciona al tope del viewport
- **AND** abarca el ancho completo del viewport

#### Scenario: Scrolling the page

- **WHEN** el usuario hace scroll vertical
- **THEN** la `Navbar` permanece visible (sticky), anclada al tope

#### Scenario: Navbar ausente en áreas autenticadas

- **WHEN** un usuario navega a `/org/{slug}`, `/super-admin`, `/onboarding/...` o `/invitations/{token}`
- **THEN** la `Navbar` de marketing NO se renderiza en esa página

### Requirement: Authentication entry-point buttons

La `Navbar` SHALL exponer acciones de autenticación que navegan a rutas reales y que se adaptan al estado de sesión del visitante. La navbar es server component y MUST consultar `getSession()` para decidir qué CTAs mostrar.

#### Scenario: Visitante sin sesión

- **WHEN** la landing page se renderiza para un visitante sin sesión
- **THEN** la `Navbar` muestra un único botón con label "Iniciar sesión"
- **AND** ese botón navega a `/sign-in`

#### Scenario: Visitante con sesión

- **WHEN** la landing page se renderiza para un usuario autenticado
- **THEN** la `Navbar` muestra una acción "Dashboard" que navega a `/post-auth`
- **AND** muestra una acción "Cerrar sesión" que invoca `signOut()` del cliente better-auth y redirige a `/`

#### Scenario: No existe botón "Registrarse"

- **WHEN** la landing page se renderiza
- **THEN** la `Navbar` NO MUST contener un botón con label "Registrarse"

#### Scenario: Copy en español neutro

- **WHEN** los CTAs de la `Navbar` se renderizan en cualquier estado
- **THEN** los labels usan "tú" y NO contienen voseo ni regionalismos

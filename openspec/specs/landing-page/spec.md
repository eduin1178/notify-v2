# Spec: landing-page

## Purpose

Defines the public-facing landing page served at the root path (`/`) of the Notify web application. Covers branding, navigation bar behavior, authentication entry-point buttons, hero section, and copy language requirements.

---

## Requirements

### Requirement: Landing page is served at the root path

The system SHALL render a public landing page at the route `/` of the web application, replacing any scaffolding content from `create-next-app`.

#### Scenario: Visiting the root path

- **WHEN** an unauthenticated visitor opens `/`
- **THEN** the response renders the Notify landing page (navbar + hero) without any redirect

---

### Requirement: Site branding identifies the product as "Notify"

The system SHALL identify the site as "Notify" through both the document metadata and the visible brand in the navbar.

#### Scenario: Document title

- **WHEN** the landing page is rendered
- **THEN** the HTML `<title>` is "Notify"
- **AND** the `<html lang>` attribute is `"es"`

#### Scenario: Visible brand

- **WHEN** the landing page is rendered
- **THEN** the navbar displays the text "Notify" as the brand element

---

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

---

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

---

### Requirement: Hero section with placeholder content

The landing page SHALL include a hero section beneath the navbar that introduces the product with placeholder copy written in Spanish neutral (tú form, no voseo).

#### Scenario: Hero is rendered

- **WHEN** the landing page is rendered
- **THEN** the page displays a hero section containing a primary heading and a supporting paragraph

#### Scenario: Copy language

- **WHEN** the hero copy is rendered
- **THEN** all visible strings use Spanish neutral with the second-person singular "tú" (e.g., "necesitas", never "necesitás")

---

### Requirement: User-facing copy uses Spanish neutral

All user-visible strings on the landing page (navbar brand, button labels, hero copy, metadata description) SHALL be written in Spanish neutral, using the "tú" form and avoiding voseo or other regional variants.

#### Scenario: Copy review

- **WHEN** any visible string on the landing page or in document metadata is rendered
- **THEN** it does not contain voseo conjugations (e.g., "ingresá", "registrate", "querés", "vos", "sos")
- **AND** verbs addressing the visitor use the "tú" form (e.g., "ingresa", "regístrate", "quieres")

---

### Requirement: Footer básico con marca y toggle de tema

El route group `(marketing)/` SHALL renderizar un footer al pie de la página que contenga, como mínimo, la marca "Notify" con copyright del año actual y el componente `ThemeToggle`. El footer MUST renderizarse solo dentro de `(marketing)/`; NO MUST aparecer en áreas autenticadas ni en rutas públicas fuera de marketing.

#### Scenario: Footer en la landing

- **WHEN** un visitante abre `/`
- **THEN** la página renderiza al pie un footer con el texto "Notify" y el copyright del año actual
- **AND** el footer contiene el componente `ThemeToggle`

#### Scenario: Footer ausente fuera de marketing

- **WHEN** un usuario navega a `/sign-in`, `/org/{slug}`, `/super-admin`, `/onboarding/...`, `/account` o `/invitations/{token}`
- **THEN** el footer de marketing NO se renderiza en esa página

#### Scenario: Copy del footer en español neutral

- **WHEN** el footer se renderiza
- **THEN** los strings visibles usan "tú" y NO contienen voseo ni regionalismos

---

### Requirement: Toggle de tema disponible en `/sign-in`

La página `/sign-in` SHALL exponer el componente `ThemeToggle` en una posición visible y accesible (por ejemplo, esquina superior derecha) para que un visitante sin sesión pueda elegir su tema antes de autenticarse.

#### Scenario: Visitante en `/sign-in`

- **WHEN** un visitante sin sesión abre `/sign-in`
- **THEN** la página renderiza el componente `ThemeToggle` accesible desde la primera carga

#### Scenario: Persistencia tras autenticación

- **WHEN** un visitante cambia el tema en `/sign-in` y luego inicia sesión
- **THEN** la cookie `notify-theme` persiste y el tema elegido sigue activo en el shell autenticado

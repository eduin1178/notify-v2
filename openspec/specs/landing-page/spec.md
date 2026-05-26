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

The system SHALL render a top navigation bar that remains visible at the top of the viewport while the user scrolls the landing page.

#### Scenario: Initial render

- **WHEN** the landing page is rendered
- **THEN** the navbar is positioned at the top of the viewport
- **AND** it spans the full width of the viewport

#### Scenario: Scrolling the page

- **WHEN** the user scrolls the page vertically
- **THEN** the navbar remains visible (sticky), pinned to the top of the viewport

---

### Requirement: Authentication entry-point buttons

The navbar SHALL expose two buttons that anticipate future authentication routes: "Iniciar sesión" and "Registrarse". They are non-functional placeholders in this change.

#### Scenario: Buttons are present

- **WHEN** the landing page is rendered
- **THEN** the navbar contains a button labeled "Iniciar sesión"
- **AND** the navbar contains a button labeled "Registrarse"

#### Scenario: Visual hierarchy

- **WHEN** the navbar buttons are rendered
- **THEN** "Iniciar sesión" uses the shadcn `Button` `variant="ghost"` (low visual weight)
- **AND** "Registrarse" uses the shadcn `Button` `variant="default"` (primary visual weight)

#### Scenario: No navigation

- **WHEN** the user clicks either button
- **THEN** the system does not navigate to a new route and does not throw an error

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

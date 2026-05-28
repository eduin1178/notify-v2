## ADDED Requirements

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

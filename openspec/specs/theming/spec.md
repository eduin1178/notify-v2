# Spec: theming

## Purpose

Define cómo Notify persiste y aplica la preferencia de tema visual del usuario (claro, oscuro o sistema). Cubre la cookie de preferencia, el script anti-flash en el `<head>` del root layout, el componente `ThemeToggle` reutilizable y los tokens semánticos en `globals.css` que soportan ambos modos. La implementación es propia (sin `next-themes`).

---

## Requirements

### Requirement: Preferencia de tema persistida en cookie legible

El sistema SHALL persistir la preferencia de tema del visitante en una cookie llamada `notify-theme` con uno de tres valores: `light`, `dark` o `system`. La cookie MUST ser legible por JavaScript del cliente (no HTTP-only), MUST usar `SameSite=Lax`, `Path=/` y `Max-Age` de al menos un año. Cuando la cookie está ausente, el sistema MUST tratar la preferencia como `system`.

#### Scenario: Primera visita sin cookie

- **WHEN** un visitante abre cualquier página sin la cookie `notify-theme`
- **THEN** el sistema resuelve la preferencia como `system`
- **AND** aplica el tema correspondiente a `prefers-color-scheme` del navegador

#### Scenario: Visitante con preferencia previa

- **WHEN** un visitante abre cualquier página con la cookie `notify-theme=dark` (o `light`)
- **THEN** el sistema aplica el tema persistido sin consultar `prefers-color-scheme`

#### Scenario: Cookie corrupta o con valor desconocido

- **WHEN** la cookie `notify-theme` contiene un valor distinto a `light | dark | system`
- **THEN** el sistema lo trata como `system` y NO lanza error visible

---

### Requirement: Script anti-flash en el `<head>` del root layout

El sistema SHALL inyectar un script inline en el `<head>` del root `app/layout.tsx` que se ejecute antes del paint y aplique la clase `dark` al elemento `<html>` cuando el tema resuelto sea oscuro. El script MUST ejecutarse de forma síncrona y MUST tolerar errores sin romper la página.

#### Scenario: Render inicial con tema oscuro persistido

- **WHEN** un visitante con cookie `notify-theme=dark` abre cualquier página
- **THEN** el elemento `<html>` tiene la clase `dark` desde el primer paint
- **AND** no hay flash de tema claro durante la hidratación

#### Scenario: Render inicial con `system` y SO en oscuro

- **WHEN** un visitante con cookie ausente o `notify-theme=system` abre la página y su sistema operativo está configurado en oscuro
- **THEN** el elemento `<html>` tiene la clase `dark` desde el primer paint

#### Scenario: Render inicial con `system` y SO en claro

- **WHEN** un visitante con cookie ausente o `notify-theme=system` abre la página y su sistema operativo está configurado en claro
- **THEN** el elemento `<html>` NO tiene la clase `dark`

---

### Requirement: Componente `ThemeToggle` reutilizable

El sistema SHALL exponer un componente cliente `ThemeToggle` que muestre un dropdown con tres opciones: "Claro", "Oscuro", "Sistema". Cada opción MUST usar un icono de `@phosphor-icons/react` (sol, luna, monitor respectivamente). El componente MUST ser usable en cualquier superficie pública o autenticada y MUST reflejar la preferencia activa con un indicador visual.

#### Scenario: Render del control

- **WHEN** `ThemeToggle` se renderiza
- **THEN** muestra un botón con el icono que corresponde al tema resuelto actual (sol, luna o monitor)
- **AND** al hacer clic abre un dropdown con las tres opciones etiquetadas "Claro", "Oscuro", "Sistema" en español neutral

#### Scenario: Selección "Oscuro"

- **WHEN** el usuario selecciona "Oscuro" en el dropdown
- **THEN** el sistema añade la clase `dark` a `<html>` inmediatamente
- **AND** persiste `notify-theme=dark` en la cookie

#### Scenario: Selección "Claro"

- **WHEN** el usuario selecciona "Claro" en el dropdown
- **THEN** el sistema remueve la clase `dark` de `<html>` inmediatamente
- **AND** persiste `notify-theme=light` en la cookie

#### Scenario: Selección "Sistema"

- **WHEN** el usuario selecciona "Sistema" en el dropdown
- **THEN** el sistema persiste `notify-theme=system` en la cookie
- **AND** aplica la clase `dark` solo si `prefers-color-scheme: dark` está activo
- **AND** actualiza la clase si la preferencia del SO cambia mientras la página está abierta

#### Scenario: Indicador visual de la opción activa

- **WHEN** el dropdown se abre
- **THEN** la opción correspondiente al valor persistido (no al resuelto) tiene un indicador visual (check o resaltado)

---

### Requirement: Tokens de tema soportan modo oscuro

El sistema SHALL definir en `web/app/globals.css` los tokens semánticos necesarios para que todas las superficies actuales (`background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, sidebar) tengan valores diferenciados para modo claro y modo oscuro, activados por la presencia de la clase `dark` en un ancestro.

#### Scenario: Variante oscura definida

- **WHEN** se inspecciona `globals.css`
- **THEN** existe una regla `.dark { ... }` (o equivalente) que sobreescribe cada token semántico con un valor para modo oscuro

#### Scenario: Aplicación visible

- **WHEN** la clase `dark` está presente en `<html>`
- **THEN** las superficies de la app usan los valores de modo oscuro sin cambios adicionales en componentes

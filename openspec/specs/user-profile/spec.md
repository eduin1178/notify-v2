# Spec: user-profile

## Purpose

Define la página `/account` de Notify, donde un usuario autenticado gestiona su identidad, sus conexiones OAuth, las organizaciones a las que pertenece y las invitaciones recibidas en su correo. La página vive dentro del shell autenticado `(app)/` y es la única superficie de "cuenta" del producto. Es estrictamente de lectura para los datos del usuario en v1; las acciones se limitan a vincular/desvincular providers, salir de organizaciones y aceptar/rechazar invitaciones.

---

## Requirements

### Requirement: Ruta `/account` dentro del shell autenticado

El sistema SHALL exponer una ruta `/account` dentro del route group `(app)/` que renderiza la página de cuenta del usuario autenticado. La ruta MUST estar protegida por el guard de sesión del shell `(app)/`. La página MUST renderizarse dentro del mismo `SidebarProvider` + `AppSidebar` + `SidebarInset` que el resto del shell autenticado.

#### Scenario: Usuario autenticado abre `/account`

- **WHEN** un usuario con sesión válida navega a `/account`
- **THEN** la página se renderiza dentro del shell `(app)/` con `AppSidebar` a la izquierda y el contenido en `SidebarInset`

#### Scenario: Visitante sin sesión

- **WHEN** un visitante sin sesión navega a `/account`
- **THEN** el sistema lo redirige a `/sign-in` con `redirect=/account`

---

### Requirement: Sección "Datos del usuario" (solo lectura)

La página `/account` SHALL incluir una sección que muestra los datos básicos del usuario en modo solo lectura: avatar, nombre, email y fecha de registro. La UI MUST NOT exponer controles de edición en v1.

#### Scenario: Render de datos

- **WHEN** la sección se renderiza para un usuario con name "Ada Lovelace" y email "ada@example.com"
- **THEN** muestra avatar (o iniciales si no hay imagen), "Ada Lovelace", "ada@example.com" y la fecha de creación formateada

#### Scenario: Sin controles de edición

- **WHEN** la sección se renderiza
- **THEN** NO existen inputs, botones "Editar" ni ningún elemento que permita modificar los datos

---

### Requirement: Sección "Conexiones" para vincular y desvincular providers

La página `/account` SHALL incluir una sección que liste los providers soportados (Google y GitHub) e indique para cada uno si está vinculado a la cuenta. Para providers NO vinculados, el sistema MUST exponer un botón "Vincular" que invoca el flujo de OAuth correspondiente. Para providers vinculados, el sistema MUST exponer un botón "Desvincular" y un enlace externo "Gestionar cuenta" que abre la página de gestión del provider en una nueva pestaña.

#### Scenario: Usuario con Google y GitHub vinculados

- **WHEN** la sección se renderiza para un usuario con ambos providers vinculados
- **THEN** Google muestra estado "Vinculado", botón "Desvincular" y enlace "Gestionar cuenta" hacia `https://myaccount.google.com` con `target="_blank"`
- **AND** GitHub muestra estado "Vinculado", botón "Desvincular" y enlace "Gestionar cuenta" hacia `https://github.com/settings/profile` con `target="_blank"`

#### Scenario: Usuario con solo Google vinculado

- **WHEN** la sección se renderiza para un usuario con solo Google vinculado
- **THEN** Google muestra "Desvincular" y "Gestionar cuenta"
- **AND** GitHub muestra un botón "Vincular" que invoca el flujo OAuth de GitHub

#### Scenario: Vinculación exitosa

- **WHEN** el usuario hace clic en "Vincular" de un provider y completa el consentimiento
- **THEN** al volver a `/account` la sección refleja el provider como vinculado

#### Scenario: Desvinculación rechazada por el backend

- **WHEN** el usuario hace clic en "Desvincular" sobre su único provider vinculado
- **THEN** el backend rechaza la operación
- **AND** la UI muestra un mensaje de error: "No puedes desvincular tu único proveedor de acceso."
- **AND** la lista de providers no cambia

#### Scenario: Desvinculación exitosa

- **WHEN** el usuario hace clic en "Desvincular" sobre un provider que NO es el último
- **THEN** la operación tiene éxito y la sección refleja el provider como NO vinculado

---

### Requirement: Sección "Organizaciones" con opción de salir

La página `/account` SHALL incluir una sección que lista las organizaciones a las que pertenece el usuario, mostrando nombre, rol y un botón "Salir". El botón "Salir" MUST invocar la operación de abandono de la organización. El sistema MUST delegar la regla "no se puede salir si eres el único owner" al backend; la UI NO MUST precomputar esa condición.

#### Scenario: Usuario miembro de varias organizaciones

- **WHEN** la sección se renderiza para un usuario con dos memberships (rol `owner` en "Acme" y rol `member` en "Globex")
- **THEN** muestra "Acme · owner · [Salir]" y "Globex · member · [Salir]"

#### Scenario: Salida confirmada

- **WHEN** el usuario hace clic en "Salir" de una organización y confirma en el diálogo
- **THEN** el sistema invoca la operación de abandono
- **AND** si tiene éxito, la organización desaparece de la lista

#### Scenario: Salida rechazada por ser único owner

- **WHEN** el usuario es el único owner de una organización y hace clic en "Salir" y confirma
- **THEN** el backend rechaza la operación
- **AND** la UI muestra un mensaje de error explicativo
- **AND** la organización permanece en la lista

#### Scenario: Usuario sin organizaciones

- **WHEN** la sección se renderiza para un usuario sin memberships
- **THEN** muestra un estado vacío con un CTA "Crear organización" que navega a `/onboarding/new-org`

---

### Requirement: Sección "Invitaciones" con pendientes e historial

La página `/account` SHALL incluir una sección que lista las invitaciones recibidas por el email del usuario, particionadas en dos bloques: "Pendientes" (status `pending`) y "Historial" (status `accepted | rejected | canceled | expired`). El bloque "Pendientes" MUST estar siempre visible. El bloque "Historial" MUST ser colapsable y mostrar como máximo las últimas 20 invitaciones cerradas, ordenadas por fecha descendente.

#### Scenario: Invitación pendiente

- **WHEN** existe una invitación con `status=pending` para el email del usuario hacia la organización "Acme" con rol `member`
- **THEN** la sección muestra en "Pendientes": "Acme · member · [Aceptar] [Rechazar]"

#### Scenario: Aceptar invitación

- **WHEN** el usuario hace clic en "Aceptar" sobre una invitación pendiente
- **THEN** el sistema invoca la operación de aceptación
- **AND** la invitación desaparece del bloque "Pendientes" y aparece en "Historial" con estado "Aceptada"
- **AND** la organización aparece en la sección "Organizaciones"

#### Scenario: Rechazar invitación

- **WHEN** el usuario hace clic en "Rechazar" sobre una invitación pendiente
- **THEN** el sistema invoca la operación de rechazo
- **AND** la invitación desaparece del bloque "Pendientes" y aparece en "Historial" con estado "Rechazada"

#### Scenario: Historial colapsable

- **WHEN** la sección se renderiza con invitaciones cerradas
- **THEN** el bloque "Historial" aparece colapsado por defecto y al expandirse muestra las invitaciones (org · rol · estado · fecha)

#### Scenario: Límite de historial

- **WHEN** el usuario tiene más de 20 invitaciones cerradas
- **THEN** el bloque "Historial" muestra solo las 20 más recientes

#### Scenario: Sin invitaciones

- **WHEN** el usuario no tiene invitaciones recibidas
- **THEN** la sección muestra un estado vacío con copy "No tienes invitaciones."

---

### Requirement: Copy en español neutral

Todos los strings visibles en `/account` SHALL usar español neutral con segunda persona singular "tú", sin voseo ni regionalismos.

#### Scenario: Revisión de copy

- **WHEN** cualquier string visible en `/account` se renderiza
- **THEN** NO contiene formas voseo (e.g., "vinculá", "aceptá", "salí")
- **AND** usa formas "tú" donde aplica (e.g., "vincula", "acepta", "sal")

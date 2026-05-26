## Purpose

Define el modelo multi-tenant de Notify. Cada tenant es una `Organization` con identidad propia, miembros con rol independiente (`Owner`, `Admin`, `Member`), y un sistema de invitaciones por email con TTL. Cubre creación, pertenencia múltiple por usuario, onboarding determinista para usuarios sin org, transferencia de ownership, eliminación, y el ciclo de vida completo de las invitaciones (emisión, envío vía Resend, aceptación cruzada por email, expiración, reenvío).

## Requirements

### Requirement: Modelo de organización como tenant

El sistema SHALL modelar cada tenant como una `Organization` con identificador único, nombre y slug único. Cada organización MUST tener al menos un miembro con rol Owner en todo momento.

#### Scenario: Creación de organización
- **WHEN** un usuario autenticado completa el formulario de creación de organización con un nombre válido
- **THEN** el sistema crea la organización con un slug derivado del nombre, asigna al creador como Owner y la establece como organización activa de la sesión

#### Scenario: Slug duplicado
- **WHEN** el nombre propuesto produce un slug que ya existe
- **THEN** el sistema MUST sufijar el slug con un discriminador (`-2`, `-3`, ...) hasta encontrar uno libre y crear la organización exitosamente

### Requirement: Pertenencia múltiple

El sistema SHALL permitir que un mismo usuario pertenezca a múltiples organizaciones simultáneamente, con un rol independiente por organización. La sesión MUST exponer una única organización activa por vez.

#### Scenario: Usuario pertenece a varias organizaciones
- **WHEN** un usuario tiene memberships en tres organizaciones
- **THEN** el selector de organización MUST listar las tres y el usuario puede cambiar la organización activa sin cerrar sesión

#### Scenario: Cambio de organización activa
- **WHEN** el usuario selecciona otra organización en el selector
- **THEN** el sistema actualiza la organización activa en la sesión y refresca la vista

### Requirement: Onboarding determinista para usuarios sin organización

El sistema SHALL ejecutar uno de los siguientes flujos para un usuario autenticado que no tiene memberships activas:
1. Si existen invitaciones pendientes no expiradas dirigidas a su email verificado, MUST presentar la pantalla de aceptación de invitaciones.
2. Si no existen invitaciones pendientes, MUST forzar la creación de una organización antes de permitir el acceso a cualquier otra ruta protegida.

#### Scenario: Usuario nuevo sin invitaciones
- **WHEN** un usuario autenticado por primera vez no tiene memberships ni invitaciones pendientes
- **THEN** el sistema lo redirige a `/onboarding/new-org` y bloquea el acceso a otras rutas protegidas hasta que cree una organización

#### Scenario: Usuario nuevo con invitaciones pendientes
- **WHEN** un usuario autenticado por primera vez tiene una o más invitaciones pendientes no expiradas
- **THEN** el sistema lo redirige a `/onboarding/invitations` mostrando cada invitación con la opción de aceptar o continuar para crear su propia organización

#### Scenario: Usuario existente vuelve a entrar
- **WHEN** un usuario con al menos una membership inicia sesión
- **THEN** el sistema lo redirige a la última organización activa o, si no la hay, a la primera membership en orden alfabético

### Requirement: Roles dentro de la organización

El sistema SHALL definir exactamente tres roles dentro de cada organización: `Owner`, `Admin`, `Member`. La autorización de cada acción MUST resolverse según la tabla de permisos del diseño y MUST centralizarse en un helper único.

#### Scenario: Member intenta invitar
- **WHEN** un usuario con rol Member abre la vista de miembros e intenta enviar una invitación
- **THEN** el sistema MUST rechazar la acción con un error de autorización y NO MUST mostrar el formulario de invitación

#### Scenario: Admin intenta cambiar el rol de un Owner
- **WHEN** un usuario con rol Admin intenta cambiar el rol de un Owner
- **THEN** el sistema MUST rechazar la acción

#### Scenario: Owner promueve a un Member a Admin
- **WHEN** un Owner cambia el rol de un Member a Admin
- **THEN** el sistema actualiza la membership y el usuario afectado pasa a tener permisos de Admin en su próxima request

### Requirement: Transferencia de ownership

El sistema SHALL permitir a un Owner transferir su rol a otro miembro de la misma organización. La transferencia MUST ser atómica: nunca puede quedar una organización sin Owner.

#### Scenario: Transferencia exitosa
- **WHEN** un Owner inicia una transferencia hacia otro miembro existente y confirma la acción
- **THEN** el destinatario pasa a Owner y el origen pasa al rol que el Owner indique (Admin por defecto), en una sola operación transaccional

#### Scenario: El único Owner intenta salir de la organización
- **WHEN** un Owner que es el único Owner de la organización intenta abandonarla
- **THEN** el sistema MUST rechazar la acción y ofrecer transferir ownership o eliminar la organización

### Requirement: Eliminación de organización

El sistema SHALL permitir a un Owner eliminar la organización. La eliminación MUST invalidar todas las memberships e invitaciones asociadas.

#### Scenario: Owner elimina su organización
- **WHEN** un Owner confirma la eliminación de la organización
- **THEN** el sistema elimina la organización, sus memberships e invitaciones, y redirige a los miembros conectados al flujo de onboarding o a otra de sus organizaciones

### Requirement: Invitaciones por email con TTL

El sistema SHALL permitir a Owner y Admin emitir invitaciones para que un email específico se una a la organización con un rol dado (Admin o Member). Cada invitación MUST tener un token opaco único, una fecha de expiración, y MUST enviarse por email vía Resend.

#### Scenario: Crear invitación
- **WHEN** un Owner o Admin envía una invitación a `nuevo@x.com` con rol Member
- **THEN** el sistema persiste la invitación con un token único, expiración de 7 días, intenta enviar el email mediante Resend, y muestra en la UI el link copiable independientemente del resultado del envío

#### Scenario: Fallo en el envío de email
- **WHEN** el envío vía Resend falla por cualquier motivo
- **THEN** el sistema MUST persistir la invitación igualmente, registrar el error en logs y mostrar el link copiable en la UI con un aviso de "no se pudo enviar el email"

#### Scenario: Aceptación de invitación
- **WHEN** un usuario autenticado abre `/invitations/{token}` y el token es válido, no expirado, y el email autenticado coincide (case-insensitive) con el de la invitación
- **THEN** el sistema crea la membership con el rol indicado, marca la invitación como aceptada y redirige al dashboard de la organización

#### Scenario: Email no coincide
- **WHEN** un usuario autenticado abre una invitación cuyo email no coincide con el email de su sesión
- **THEN** el sistema MUST rechazar la aceptación con un mensaje claro indicando que la invitación es para otro email

#### Scenario: Invitación expirada
- **WHEN** un usuario abre una invitación cuyo `expiresAt` ya pasó
- **THEN** el sistema MUST rechazar la aceptación y ofrecer al usuario solicitar una nueva invitación

#### Scenario: Invitación a alguien que ya es miembro
- **WHEN** un Owner o Admin invita a un email que ya corresponde a un miembro de la organización
- **THEN** el sistema MUST rechazar la creación de la invitación con un mensaje indicando que el usuario ya es miembro

#### Scenario: Reenvío de invitación
- **WHEN** un Owner o Admin reenvía una invitación expirada o pendiente
- **THEN** el sistema genera un nuevo token, actualiza `expiresAt` y reintenta el envío de email

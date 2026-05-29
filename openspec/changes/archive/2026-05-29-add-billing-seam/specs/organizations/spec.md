## ADDED Requirements

### Requirement: Enforcement de asientos (`seats`) en el alta de miembros

El sistema SHALL autorizar contra el entitlement `seats` cualquier operación que incremente el número de miembros de una organización: crear una invitación, agregar un miembro directamente y aceptar una invitación. Un asiento equivale a una membresía existente; un usuario suspendido a nivel plataforma MUST seguir ocupando su asiento. Cuando la operación haría que el número de miembros supere el límite efectivo de `seats` del plan de la organización, el sistema MUST rechazarla con un error de autorización (403) y NO MUST crear la membresía ni la invitación.

#### Scenario: Invitar dentro del límite de asientos
- **WHEN** una organización con 2 de 3 asientos ocupados invita a un nuevo miembro
- **THEN** el sistema permite crear la invitación

#### Scenario: Invitar excediendo el límite de asientos
- **WHEN** una organización que ya ocupó todos los asientos de su plan intenta invitar a un nuevo miembro
- **THEN** el sistema MUST rechazar la operación con un error 403 y NO MUST crear la invitación

#### Scenario: Aceptar invitación excediendo el límite
- **WHEN** un invitado intenta aceptar una invitación pero la organización ya alcanzó su límite de asientos (p. ej. tras un cambio de plan)
- **THEN** el sistema MUST rechazar la aceptación con un error 403 y NO MUST crear la membresía

#### Scenario: Agregar miembro directamente excediendo el límite
- **WHEN** se intenta agregar un miembro a una organización que ya alcanzó su límite de asientos
- **THEN** el sistema MUST rechazar la operación con un error 403

#### Scenario: La suspensión de un usuario no libera su asiento
- **WHEN** un SuperAdmin suspende a un usuario que es miembro de una organización
- **THEN** su membresía persiste y su asiento sigue contando para el límite de `seats`

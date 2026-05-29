## ADDED Requirements

### Requirement: Gestión de plan y overrides de límite por organización desde el panel

El sistema SHALL permitir a un SuperAdmin consultar y cambiar el plan de cualquier organización, y definir o limpiar overrides de límite por entitlement key para una organización. El cambio de plan MUST actualizar la suscripción de la organización (fuente única de verdad del plan). Esta capacidad MUST operar contra la capa de servicios `billing` y NO MUST exponer ningún flujo de cobro en esta versión.

#### Scenario: SuperAdmin consulta el plan de una organización
- **WHEN** un SuperAdmin abre la ficha de una organización en `/super-admin`
- **THEN** el sistema muestra el plan vigente de su suscripción y los límites efectivos por entitlement

#### Scenario: SuperAdmin cambia el plan de una organización
- **WHEN** un SuperAdmin asigna a una organización un plan distinto (p. ej. de Trial a Plus)
- **THEN** el sistema actualiza la suscripción de la organización al nuevo plan
- **AND** las autorizaciones posteriores de esa organización usan los límites del nuevo plan
- **AND** no se ejecuta ningún cobro

#### Scenario: SuperAdmin define un override de límite
- **WHEN** un SuperAdmin establece para una organización un override de un entitlement key (p. ej. `whatsapp_numbers`)
- **THEN** el límite efectivo de ese entitlement para la organización pasa a ser el del override, prevaleciendo sobre el plan

#### Scenario: SuperAdmin limpia un override de límite
- **WHEN** un SuperAdmin elimina el override de un entitlement de una organización
- **THEN** el límite efectivo de ese entitlement vuelve a resolverse desde el plan

#### Scenario: Acceso no autorizado a la gestión de planes
- **WHEN** un usuario que no es SuperAdmin intenta cambiar el plan u override de cualquier organización
- **THEN** el sistema MUST denegar la operación sin revelar la existencia de la capacidad

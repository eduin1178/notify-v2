## Purpose

Define el vínculo y la administración del ciclo de vida de las cuentas de WhatsApp de cada organización de Notify a través de Kapso (BSP). Es la primera pieza del producto: sin la conexión de la cuenta no hay base para enviar mensajes, notificaciones ni automatizaciones. Cubre la autorización por rol (`owner`/`admin`), la vinculación 1:1 organización ↔ `customer` de Kapso, el onboarding por setup link con gating por el entitlement `whatsapp_numbers`, la detección robusta de conexión (webhook como fuente de verdad + redirect para experiencia inmediata), el listado y estado, la desconexión (confirmada por webhook), la reconexión, la seguridad e idempotencia del webhook, la no persistencia de credenciales de Meta y el modelado del estado `needs_reconnect`.

## Requirements

### Requirement: Autorización por rol para administrar conexiones

El sistema SHALL permitir generar, desconectar y reconectar cuentas de WhatsApp únicamente a usuarios con rol `owner` o `admin` de la organización indicada en el path. Los usuarios con rol `member` SHALL poder listar y ver el estado de las conexiones, pero NO modificarlas. La verificación de rol SHALL realizarse en la capa de servicios mediante la acción de dominio `org.whatsapp.connect`, no en el middleware de transporte.

#### Scenario: Owner genera un setup link
- **WHEN** un usuario con rol `owner` solicita conectar una cuenta de WhatsApp para su organización
- **THEN** el sistema autoriza la operación y devuelve el setup link

#### Scenario: Admin desconecta una cuenta
- **WHEN** un usuario con rol `admin` solicita desconectar una conexión existente de su organización
- **THEN** el sistema autoriza la operación

#### Scenario: Member intenta conectar
- **WHEN** un usuario con rol `member` solicita generar un setup link
- **THEN** el sistema rechaza la operación con un error de tipo `forbidden`

#### Scenario: Usuario no miembro
- **WHEN** un usuario que no es miembro de la organización del path solicita cualquier operación de conexión
- **THEN** el sistema rechaza la operación con un error de tipo `forbidden`

### Requirement: Vinculación organización ↔ customer de Kapso

El sistema SHALL mantener una relación 1:1 entre una organización de Notify y un `customer` de Kapso, persistida en `organization.kapso_customer_id`. El `customer` de Kapso SHALL crearse de forma perezosa la primera vez que la organización inicia una conexión, usando el `organizationId` como `external_id` para garantizar idempotencia. El sistema NUNCA SHALL crear más de un `customer` de Kapso por organización.

#### Scenario: Primera conexión crea el customer
- **WHEN** una organización sin `kapso_customer_id` inicia su primera conexión
- **THEN** el sistema crea un `customer` en Kapso con `external_id` igual al `organizationId` y persiste el `kapso_customer_id` en la organización

#### Scenario: Conexión posterior reutiliza el customer
- **WHEN** una organización que ya tiene `kapso_customer_id` inicia otra conexión
- **THEN** el sistema reutiliza el `customer` existente y no crea uno nuevo

### Requirement: Generación de setup link con gating por plan

El sistema SHALL generar un setup link de Kapso para onboarding, con `allowed_connection_types` igual a `["coexistence","dedicated"]` (el administrador elige en el embedded signup), `language` en español y las URLs de redirect de éxito y fallo de Notify. El setup link SHALL persistirse como una conexión en estado `pending` correlacionada por `setup_link_id`.

El estado `pending` representa un intento en curso y NO cuenta contra el entitlement `whatsapp_numbers` (que limita números comprometidos: `connected` y `needs_reconnect`). Si ya existe un intento `pending` para la organización, el sistema SHALL REUTILIZARLO regenerando el setup link (Kapso revoca el anterior) en lugar de crear otra conexión, y NO SHALL aplicar el gating en ese caso. El gating contra `whatsapp_numbers` SHALL aplicarse únicamente cuando se crea un número nuevo (sin `pending` previo).

#### Scenario: Generación exitosa dentro del límite
- **WHEN** un owner/admin solicita conectar, no hay intento `pending` y la organización está por debajo de su límite de `whatsapp_numbers`
- **THEN** el sistema genera el setup link, crea una conexión `pending` con su `setup_link_id` y devuelve la `url` al cliente

#### Scenario: Reintento reutiliza el intento pendiente
- **WHEN** un owner/admin solicita conectar y ya existe una conexión en estado `pending`
- **THEN** el sistema regenera el setup link sobre esa misma conexión (sin crear otra ni consumir otro cupo) y devuelve la nueva `url`

#### Scenario: Límite de plan alcanzado
- **WHEN** un owner/admin solicita conectar un número nuevo (sin `pending` previo) y la organización ya alcanzó su límite de `whatsapp_numbers`
- **THEN** el sistema rechaza la operación con un error de tipo `forbidden` que indica el límite del plan y NO genera el setup link

### Requirement: Detección de conexión por webhook (fuente de verdad)

El sistema SHALL recibir el webhook de proyecto `whatsapp.phone_number.created` y tratarlo como la fuente de verdad de una conexión exitosa. Al recibirlo, el sistema SHALL resolver la organización mediante `customer.id → kapso_customer_id → organizationId`, promover la conexión `pending` correspondiente a estado `connected` y registrar `phone_number_id`, y cuando estén disponibles `business_account_id` y `display_phone_number`.

#### Scenario: Webhook de conexión exitosa
- **WHEN** llega el evento `whatsapp.phone_number.created` para un `customer.id` con una conexión `pending`
- **THEN** el sistema marca la conexión como `connected` y persiste el `phone_number_id`

#### Scenario: Webhook de customer desconocido
- **WHEN** llega un evento cuyo `customer.id` no corresponde a ninguna organización conocida
- **THEN** el sistema responde 200 (para evitar reintentos) y registra el evento como ignorado, sin crear datos

### Requirement: Detección de conexión por redirect (experiencia inmediata)

El sistema SHALL aceptar el redirect de éxito (`success_redirect_url`) con sus query params (`setup_link_id`, `status`, `phone_number_id`, `business_account_id`, `display_phone_number`) para ofrecer confirmación inmediata al usuario, y el redirect de fallo (`failure_redirect_url`) con su `error_code`. El redirect SHALL ser solo para experiencia de usuario y NUNCA SHALL ser la única fuente de verdad del estado de la conexión.

#### Scenario: Redirect de éxito antes del webhook
- **WHEN** el usuario regresa por el `success_redirect_url` y el webhook aún no ha llegado
- **THEN** el sistema muestra un estado de confirmación basado en los query params sin marcar definitivamente la conexión, que se consolidará con el webhook

#### Scenario: Redirect de fallo
- **WHEN** el usuario regresa por el `failure_redirect_url` con un `error_code`
- **THEN** el sistema muestra un mensaje de error correspondiente y la conexión permanece `pending` o pasa a `failed`

### Requirement: Listado y estado de conexiones

El sistema SHALL exponer el listado de las conexiones de WhatsApp de una organización y el detalle de estado de una conexión, devolviendo identificadores y estado (`pending`, `connected`, `disconnected`, `needs_reconnect`, `failed`), sin exponer ningún secreto.

#### Scenario: Listar conexiones de la organización
- **WHEN** un miembro de la organización solicita el listado de conexiones
- **THEN** el sistema devuelve las conexiones de esa organización con su estado actual

#### Scenario: Aislamiento entre organizaciones
- **WHEN** se solicita el listado para una organización
- **THEN** el sistema devuelve únicamente las conexiones de esa organización y nunca las de otra

### Requirement: Desconexión de una cuenta

El sistema SHALL permitir a un owner/admin desconectar una cuenta. Para una conexión con número (`connected`/`needs_reconnect`), la acción SHALL solicitar a Kapso la eliminación del número, y la transición autoritativa al estado `disconnected` SHALL producirse al recibir el webhook `whatsapp.phone_number.deleted`; mientras tanto, el sistema MAY reflejar un estado optimista. Para un intento sin número (`pending`/`failed`), la acción SHALL eliminar la conexión (cancelarla) sin llamar a Kapso.

#### Scenario: Desconexión iniciada por el usuario
- **WHEN** un owner/admin desconecta una conexión `connected`
- **THEN** el sistema solicita a Kapso la eliminación del número y, al recibir `whatsapp.phone_number.deleted`, marca la conexión como `disconnected`

#### Scenario: Cancelación de un intento pendiente
- **WHEN** un owner/admin cancela una conexión en estado `pending` (sin número asignado)
- **THEN** el sistema elimina la conexión sin llamar a Kapso, liberando el intento para volver a empezar

### Requirement: Eliminación externa detectada por webhook (anti-drift)

El sistema SHALL recibir el webhook `whatsapp.phone_number.deleted` también cuando el número se elimina fuera de Notify (por ejemplo, removido directamente en Kapso o Meta) y SHALL marcar la conexión correspondiente como `disconnected` para evitar desincronización de estado.

#### Scenario: Número removido fuera de la aplicación
- **WHEN** llega `whatsapp.phone_number.deleted` para un `phone_number_id` que en Notify figura como `connected` sin que el usuario haya iniciado la desconexión
- **THEN** el sistema marca la conexión como `disconnected`

### Requirement: Reconexión de una cuenta

El sistema SHALL permitir a un owner/admin reconectar un número existente cuya conexión se rompió, generando un setup link con `reconnect_phone_number`. Esta operación SHALL forzar `provision_phone_number=false` y fijar `allowed_connection_types` al tipo del config existente. La reconexión exitosa SHALL detectarse por el re-disparo de `whatsapp.phone_number.created`.

#### Scenario: Reconexión exitosa
- **WHEN** un owner/admin reconecta un número en estado `needs_reconnect` y completa el embedded signup
- **THEN** el sistema recibe `whatsapp.phone_number.created` para ese `phone_number_id` y restablece la conexión a `connected`

### Requirement: Seguridad e idempotencia del webhook

El endpoint de webhook de Kapso SHALL vivir fuera de `/api/v1`, sin requerir sesión de usuario, y SHALL verificar la firma de cada petición antes de procesarla, rechazando con 401 las firmas inválidas. El procesamiento de eventos SHALL ser idempotente: recibir el mismo evento más de una vez NO SHALL producir efectos duplicados.

#### Scenario: Firma inválida
- **WHEN** llega una petición al webhook con firma inválida o ausente
- **THEN** el sistema responde 401 y no procesa el evento

#### Scenario: Evento duplicado
- **WHEN** el mismo evento de webhook se recibe dos veces
- **THEN** el sistema aplica el efecto una sola vez y responde 200 en ambas

### Requirement: No persistencia de credenciales de Meta

El sistema NUNCA SHALL almacenar tokens ni credenciales de Meta. Toda operación contra Kapso SHALL autenticarse con la `KAPSO_API_KEY` a nivel de plataforma. La tabla de conexiones SHALL contener únicamente identificadores no secretos (`phone_number_id`, `business_account_id`, `display_phone_number`, `kapso_customer_id`, `setup_link_id`, estado).

#### Scenario: Persistencia sin secretos
- **WHEN** se persiste una conexión de WhatsApp
- **THEN** el registro contiene solo identificadores y estado, y ningún token ni credencial de Meta

### Requirement: Estado needs_reconnect modelado sin disparo automático

El sistema SHALL modelar el estado `needs_reconnect` en el modelo de datos y soportar la acción de reconexión. El disparo automático de este estado a partir de errores de autenticación en el envío de mensajes (`whatsapp.message.failed`) queda FUERA DEL ALCANCE de este cambio, por depender de una capa de envío aún inexistente.

#### Scenario: Estado disponible para reconexión
- **WHEN** una conexión se encuentra en estado `needs_reconnect`
- **THEN** el sistema permite a un owner/admin iniciar la reconexión sobre ella

#### Scenario: Sin listener automático en este alcance
- **WHEN** se implementa este cambio
- **THEN** no se incluye ningún listener de `whatsapp.message.failed` que transicione automáticamente a `needs_reconnect`

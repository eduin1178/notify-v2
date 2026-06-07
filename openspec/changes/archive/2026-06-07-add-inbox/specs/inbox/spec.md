## ADDED Requirements

### Requirement: Inbox por número con selector como filtro principal

El sistema SHALL exponer una bandeja de conversaciones por organización en la que el **selector de número** de WhatsApp es el filtro principal: el inbox SHALL mostrar siempre las conversaciones de **un único** `whatsapp_connection` `connected` de la organización. Por defecto SHALL seleccionarse el primer número conectado. El acceso SHALL estar aislado por organización. La referencia visual del layout es el [mockup](../../assets/inbox-mockup.md), que forma parte de este requerimiento.

#### Scenario: Selección por defecto
- **WHEN** un miembro abre el inbox y la organización tiene al menos un número `connected`
- **THEN** el sistema muestra las conversaciones del primer número conectado, sin requerir selección manual

#### Scenario: Cambio de número
- **WHEN** un miembro elige otro número en el selector
- **THEN** el sistema muestra únicamente las conversaciones de ese número

#### Scenario: Aislamiento entre organizaciones
- **WHEN** se solicitan las conversaciones de una organización
- **THEN** el sistema devuelve únicamente conversaciones de números de esa organización y nunca de otra

#### Scenario: Sin números conectados
- **WHEN** un miembro abre el inbox y la organización no tiene ningún número `connected`
- **THEN** el sistema muestra un estado vacío que invita a conectar un número, sin error

### Requirement: Índice local de conversaciones (híbrido con Kapso)

El sistema SHALL mantener una fila de índice por conversación en su propia base de datos, correlacionada con la conversación de Kapso por `kapso_conversation_id` (único), conteniendo el número (`whatsapp_connection`), el contacto enlazado, el estado de negocio, la asignación, los datos de la ventana de 24h y campos denormalizados de preview (último mensaje, hora, no leídos). El listado de la bandeja SHALL servirse desde este índice local. El **contenido de los mensajes y el media** SHALL leerse de Kapso por read-through y NO SHALL duplicarse en la base de datos en este alcance.

#### Scenario: Pintar la lista desde el índice local
- **WHEN** un miembro lista conversaciones de un número
- **THEN** el sistema responde desde su índice local con preview, estado, asignación y no leídos, sin requerir una llamada a Kapso para listar

#### Scenario: Abrir el hilo lee de Kapso
- **WHEN** un miembro abre una conversación
- **THEN** el sistema obtiene los mensajes (y sus media) desde Kapso para esa conversación, paginados

### Requirement: Recepción de mensajes por webhook

El sistema SHALL recibir los eventos de Kapso `whatsapp.message.received`, `whatsapp.message.sent`, `whatsapp.message.delivered`, `whatsapp.message.read`, `whatsapp.message.failed` y `whatsapp.conversation.created|ended|inactive` en la ruta de webhook existente, verificando la firma antes de procesar. Al recibir un entrante (`received`), el sistema SHALL resolver la organización por `phone_number_id → whatsapp_connection`, hacer *upsert* de la conversación en el índice por `kapso_conversation_id`, actualizar `last_inbound_at`, el preview del último mensaje e incrementar el contador de no leídos.

#### Scenario: Entrante crea o actualiza la conversación
- **WHEN** llega `whatsapp.message.received` para un número conocido de la organización
- **THEN** el sistema hace upsert de la conversación, actualiza `last_inbound_at` y el preview, e incrementa los no leídos

#### Scenario: Número desconocido
- **WHEN** llega un evento de mensaje cuyo `phone_number_id` no corresponde a ninguna conexión conocida
- **THEN** el sistema responde 200 y registra el evento como ignorado, sin crear datos

#### Scenario: Firma inválida
- **WHEN** llega una petición al webhook con firma inválida o ausente
- **THEN** el sistema responde 401 y no procesa el evento

### Requirement: Suscripción automática a eventos de mensaje por número

El sistema SHALL garantizar que cada número `connected` tenga registrado en Kapso un webhook number-scoped (`kind=kapso`, sin buffering) para los eventos de mensaje y conversación, apuntando a la ruta de webhook de Notify. El registro SHALL realizarse automáticamente al detectar la conexión exitosa de un número y SHALL ser idempotente.

#### Scenario: Registro al conectar
- **WHEN** un número de la organización pasa a `connected`
- **THEN** el sistema registra (si no existe ya) un webhook number-scoped de eventos de mensaje para ese número

#### Scenario: Idempotencia del registro
- **WHEN** el sistema procesa de nuevo la conexión de un número que ya tiene su webhook de mensajes
- **THEN** el sistema no crea un webhook duplicado

### Requirement: Estados de negocio de la conversación

El sistema SHALL gestionar el estado de cada conversación con los valores `abierta`, `pendiente` y `cerrada`, propios de Notify e **independientes** del estado de Kapso. Una conversación nueva SHALL iniciarse en `abierta`. El paso a `pendiente` SHALL ser **manual** (acción del agente). El sistema NO SHALL sincronizar este estado con el `status` de Kapso.

#### Scenario: Conversación nueva nace abierta
- **WHEN** se crea una conversación por un primer entrante
- **THEN** su estado de negocio es `abierta`

#### Scenario: Marcar pendiente manualmente
- **WHEN** un miembro marca una conversación como `pendiente`
- **THEN** el sistema persiste el estado `pendiente`

#### Scenario: Filtrar por estado
- **WHEN** un miembro filtra la bandeja por `abierta`, `pendiente` o `cerrada`
- **THEN** el sistema devuelve solo las conversaciones en ese estado para el número seleccionado

### Requirement: Reapertura ante entrante configurable por número

El sistema SHALL aplicar, cuando llega un mensaje entrante a una conversación `cerrada`, el comportamiento definido en la configuración del número (`reopen_behavior`): `reopen_keep_agent` (reabrir a `abierta` conservando el agente asignado), `reopen_unassign` (reabrir a `abierta` y dejar sin asignar) o `stay_closed` (permanecer `cerrada`). El valor por defecto, cuando no se ha configurado, SHALL ser `reopen_keep_agent`.

#### Scenario: Reapertura conservando agente (default)
- **WHEN** llega un entrante a una conversación `cerrada` de un número sin configuración explícita
- **THEN** el sistema la reabre a `abierta` conservando su `assigned_user_id` previo

#### Scenario: Reapertura sin asignar
- **WHEN** llega un entrante a una conversación `cerrada` de un número configurado con `reopen_unassign`
- **THEN** el sistema la reabre a `abierta` y limpia la asignación

#### Scenario: Permanecer cerrada
- **WHEN** llega un entrante a una conversación `cerrada` de un número configurado con `stay_closed`
- **THEN** el sistema mantiene el estado `cerrada` (el mensaje se registra igual)

### Requirement: Ventana de servicio de 24 horas

El sistema SHALL calcular la ventana de servicio de cada conversación como `last_inbound_at + 24h` y SHALL impedir el envío de **mensajes de servicio** (texto y media no-plantilla) fuera de esa ventana. Dentro de la ventana, el envío de servicio SHALL permitirse. La UI SHALL mostrar el tiempo restante de la ventana y, fuera de ella, SHALL forzar el uso de plantilla. Una conversación sin `last_inbound_at` (proactiva, sin entrante previo) SHALL tratarse como ventana cerrada.

#### Scenario: Envío de servicio dentro de la ventana
- **WHEN** un agente envía un mensaje de servicio y `ahora ≤ last_inbound_at + 24h`
- **THEN** el sistema permite el envío

#### Scenario: Envío de servicio fuera de la ventana
- **WHEN** un agente intenta enviar un mensaje de servicio y `ahora > last_inbound_at + 24h`
- **THEN** el sistema rechaza la operación e indica que debe usar una plantilla

#### Scenario: Indicador de ventana en la UI
- **WHEN** un agente abre una conversación con ventana abierta
- **THEN** la UI muestra el tiempo restante de la ventana de 24h

### Requirement: Envío de mensajes de servicio multimedia

El sistema SHALL permitir enviar, dentro de la ventana de 24h, mensajes de tipo texto, imagen, documento, audio y video a la conversación, a través de Kapso. El media saliente SHALL subirse directamente desde el navegador a un almacenamiento de blobs mediante una URL firmada y enviarse a Kapso por `link`. Tras la confirmación de Kapso, el sistema SHALL actualizar el preview de la conversación y poner los no leídos en cero.

#### Scenario: Enviar texto
- **WHEN** un agente envía un texto en una conversación con ventana abierta
- **THEN** el sistema lo envía por Kapso y refleja el mensaje saliente en el hilo

#### Scenario: Enviar media grande
- **WHEN** un agente adjunta un archivo (p. ej. un video) que supera el límite de body de la función
- **THEN** el archivo se sube directamente al almacenamiento de blobs por URL firmada y el mensaje se envía a Kapso con el `link` correspondiente

#### Scenario: Mostrar media entrante
- **WHEN** una conversación contiene media entrante
- **THEN** el sistema lo muestra usando la URL de media provista por Kapso, sin duplicar el archivo

### Requirement: Envío de mensajes de plantilla

El sistema SHALL permitir seleccionar una plantilla aprobada del número y completar sus variables antes de enviarla. Si la plantilla tiene cabecera de imagen, video o documento, el sistema SHALL permitir adjuntar el archivo correspondiente (subido al almacenamiento de blobs) antes del envío. El envío de plantilla SHALL permitirse **también fuera** de la ventana de 24h.

#### Scenario: Enviar plantilla con variables
- **WHEN** un agente selecciona una plantilla, completa sus variables y envía
- **THEN** el sistema envía la plantilla por Kapso con las variables resueltas

#### Scenario: Plantilla con cabecera de media
- **WHEN** la plantilla seleccionada requiere una cabecera de imagen, video o documento
- **THEN** el sistema exige adjuntar el archivo y lo incluye en el envío de la plantilla

#### Scenario: Plantilla fuera de la ventana
- **WHEN** un agente envía una plantilla en una conversación con ventana cerrada
- **THEN** el sistema permite el envío (las plantillas no están sujetas a la ventana de servicio)

### Requirement: Envío de mensajes interactivos

El sistema SHALL permitir enviar mensajes interactivos de tipo botones de respuesta, listas y CTA URL dentro de la ventana de 24h, a través de Kapso. El sistema SHALL mostrar las respuestas interactivas entrantes del cliente en el hilo.

#### Scenario: Enviar botones
- **WHEN** un agente compone un mensaje interactivo de botones y lo envía con la ventana abierta
- **THEN** el sistema lo envía por Kapso y lo refleja en el hilo

#### Scenario: Respuesta interactiva entrante
- **WHEN** el cliente responde a un mensaje interactivo
- **THEN** el sistema muestra la respuesta en el hilo de la conversación

### Requirement: Asignación de conversaciones a agentes

El sistema SHALL permitir asignar una conversación a un usuario (agente) de la organización y reasignarla. El sistema SHALL permitir filtrar la bandeja por **Mis conversaciones** (asignadas al usuario actual), **Sin asignar** (sin asignación) y **Otros** (asignadas a otro usuario). La asignación SHALL referenciar a un usuario de Notify, no a un usuario de Kapso.

#### Scenario: Asignar a un agente
- **WHEN** un miembro asigna una conversación a un usuario de la organización
- **THEN** el sistema persiste `assigned_user_id` y la conversación aparece en "Mis conversaciones" de ese usuario

#### Scenario: Filtro Sin asignar
- **WHEN** un miembro filtra por "Sin asignar"
- **THEN** el sistema devuelve solo las conversaciones sin `assigned_user_id` para el número seleccionado

#### Scenario: Filtro Otros
- **WHEN** un miembro filtra por "Otros"
- **THEN** el sistema devuelve las conversaciones asignadas a un usuario distinto del actual

### Requirement: Iniciar conversación desde contactos

El sistema SHALL permitir iniciar una conversación desde la lista de contactos, eligiendo el número de la organización con el que contactar. La UI SHALL imponer la política de Meta: si el contacto tiene una ventana de 24h abierta, SHALL ofrecer mensaje de servicio o plantilla; si no la tiene, SHALL permitir **únicamente** plantilla.

#### Scenario: Inicio proactivo (sin ventana)
- **WHEN** un miembro inicia una conversación desde un contacto que no tiene ventana abierta
- **THEN** la UI permite únicamente enviar una plantilla y no ofrece mensaje de servicio

#### Scenario: Inicio con ventana abierta
- **WHEN** un miembro inicia una conversación desde un contacto que escribió en las últimas 24h
- **THEN** la UI permite enviar mensaje de servicio o plantilla

### Requirement: Contacto al vuelo en entrantes desconocidos

El sistema SHALL crear automáticamente un contacto cuando llega un entrante desde un teléfono que no existe en la organización, normalizando el teléfono a E.164, usando `profile_name` como nombre y `source = whatsapp`, y SHALL enlazar la conversación a ese contacto. Si la identidad no incluye teléfono normalizable (BSUID-only), la conversación SHALL poder existir sin contacto enlazado.

#### Scenario: Entrante de número no registrado
- **WHEN** llega un entrante de un teléfono que no existe en contactos
- **THEN** el sistema crea el contacto (`source=whatsapp`) y enlaza la conversación a él

#### Scenario: Entrante sin teléfono (BSUID-only)
- **WHEN** llega un entrante con identidad sin teléfono normalizable
- **THEN** el sistema mantiene la conversación sin contacto enlazado, sin crear un contacto inválido

### Requirement: No leídos y marca de leído configurable

El sistema SHALL mantener un contador de mensajes no leídos por conversación, incrementándolo en cada entrante y poniéndolo en cero cuando el agente abre/lee la conversación. El envío del acuse de lectura (✓✓ azul) a WhatsApp SHALL depender de la configuración del número (`send_read_receipts`), cuyo valor por defecto SHALL ser activado.

#### Scenario: Reset de no leídos al abrir
- **WHEN** un agente abre una conversación con no leídos
- **THEN** el sistema pone su contador de no leídos en cero

#### Scenario: Acuse de lectura activado
- **WHEN** un agente lee una conversación de un número con `send_read_receipts` activado
- **THEN** el sistema marca los mensajes como leídos en WhatsApp (✓✓ azul para el cliente)

#### Scenario: Acuse de lectura desactivado
- **WHEN** un agente lee una conversación de un número con `send_read_receipts` desactivado
- **THEN** el sistema pone los no leídos en cero pero NO envía acuse de lectura a WhatsApp

### Requirement: Estados de entrega de los mensajes salientes

El sistema SHALL reflejar el estado de entrega de los mensajes salientes (`pending`, `sent`, `delivered`, `read`, `failed`) a partir de los eventos de Kapso, y SHALL indicar los fallos de envío con su motivo cuando esté disponible.

#### Scenario: Progresión de entrega
- **WHEN** llegan eventos `whatsapp.message.sent`, `.delivered` y `.read` para un saliente
- **THEN** el sistema actualiza el estado de entrega mostrado para ese mensaje

#### Scenario: Fallo de envío
- **WHEN** llega `whatsapp.message.failed` para un saliente
- **THEN** el sistema marca el mensaje como fallido e indica el motivo del error cuando esté disponible

### Requirement: Medición de uso por mensaje y conversación

El sistema SHALL registrar un evento de uso (`usage_event`) por **cada mensaje** entrante y saliente (plantilla y servicio), con métrica `message`, deduplicado por el identificador de mensaje de Meta (WAMID) para no contar dos veces ante reentregas o lotes. El sistema SHALL registrar además una métrica `conversation` por cada apertura de ventana de 24h, destinada **solo a analítica**. El inbox NO SHALL bloquear el envío por alcanzar un cupo de plan.

#### Scenario: Conteo de todo mensaje
- **WHEN** se recibe o se envía un mensaje
- **THEN** el sistema registra un `usage_event` con métrica `message`

#### Scenario: Sin doble conteo
- **WHEN** el mismo mensaje (mismo WAMID) llega más de una vez por reentrega o lote
- **THEN** el sistema registra su uso una sola vez

#### Scenario: Sin bloqueo por cupo
- **WHEN** un agente envía un mensaje y la organización superó cualquier cupo de plan
- **THEN** el sistema NO bloquea el envío por cupo (solo mide)

### Requirement: Configuración del inbox por número

El sistema SHALL exponer una configuración por número (`inbox_settings`) con al menos `reopen_behavior` y `send_read_receipts`. Solo usuarios con rol `owner` o `admin` SHALL poder modificarla; los `member` SHALL poder leerla. La configuración SHALL aplicarse al comportamiento del inbox de ese número.

#### Scenario: Owner/admin edita la configuración
- **WHEN** un usuario `owner` o `admin` cambia `reopen_behavior` o `send_read_receipts` de un número
- **THEN** el sistema persiste la configuración y la aplica a las conversaciones de ese número

#### Scenario: Member intenta editar
- **WHEN** un usuario `member` intenta modificar la configuración del inbox de un número
- **THEN** el sistema rechaza la operación con un error de tipo `forbidden`

### Requirement: Autorización por membresía en el inbox

El sistema SHALL permitir a cualquier usuario que sea miembro de la organización del path usar el inbox: listar y ver conversaciones de los números de la organización, enviar mensajes, asignar y cambiar estado. La edición de la configuración por número SHALL restringirse a `owner`/`admin`. Los usuarios que no sean miembros SHALL ser rechazados.

#### Scenario: Miembro usa el inbox
- **WHEN** un usuario miembro de la organización lista, abre, asigna, cambia estado o envía en una conversación
- **THEN** el sistema autoriza la operación

#### Scenario: Usuario no miembro
- **WHEN** un usuario que no es miembro de la organización del path intenta cualquier operación del inbox
- **THEN** el sistema rechaza la operación con un error de tipo `forbidden`

## Purpose

Define la bandeja de conversaciones (inbox) por organización en Notify: la superficie operativa donde los agentes reciben, leen y responden mensajes de WhatsApp a través de los números conectados de la organización vía Kapso. Cubre la arquitectura híbrida (índice local de conversaciones en Notify + mensajes y media leídos de Kapso por read-through), la recepción por webhook con suscripción automática por número, los estados de negocio (`abierta`/`pendiente`/`cerrada`) independientes de Kapso, la reapertura configurable por número, el cumplimiento de la ventana de servicio de 24h de Meta, el envío de mensajes de servicio (texto, imagen, documento, audio, video), plantillas e interactivos, la asignación a agentes Notify con filtros, el inicio de conversación desde contactos, el contacto al vuelo, los no leídos y la marca de leído configurable, los estados de entrega, la medición de uso por mensaje y conversación, la configuración por número (`inbox_settings`) y la autorización por membresía. La referencia visual del layout es el [mockup](assets/inbox-mockup.md).
## Requirements
### Requirement: Inbox por número con selector como filtro principal

El sistema SHALL exponer una bandeja de conversaciones por organización en la que el **selector de número** de WhatsApp es el filtro principal: el inbox SHALL mostrar siempre las conversaciones de **un único** `whatsapp_connection` `connected` de la organización. Por defecto SHALL seleccionarse el primer número conectado. El acceso SHALL estar aislado por organización. La referencia visual del layout es el [mockup](assets/inbox-mockup.md), que forma parte de este requerimiento.

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

El sistema SHALL recibir los eventos de Kapso `whatsapp.message.received`, `whatsapp.message.sent`, `whatsapp.message.delivered`, `whatsapp.message.read`, `whatsapp.message.failed` y `whatsapp.conversation.created|ended|inactive` en la ruta de webhook existente, verificando la firma antes de procesar. Al recibir un entrante (`received`), el sistema SHALL resolver la organización por `phone_number_id → whatsapp_connection`, hacer *upsert* de la conversación en el índice por `kapso_conversation_id`, actualizar `last_inbound_at`, el preview del último mensaje e incrementar el contador de no leídos. Tras confirmar el commit en la base de datos, el sistema SHALL publicar un evento de realtime en el canal de la organización y, cuando aplique, en el canal de la conversación. Un fallo de publicación de realtime NO SHALL provocar el fallo del procesamiento del webhook (es best-effort y no debe forzar reintentos de Kapso).

#### Scenario: Entrante crea o actualiza la conversación
- **WHEN** llega `whatsapp.message.received` para un número conocido de la organización
- **THEN** el sistema hace upsert de la conversación, actualiza `last_inbound_at` y el preview, e incrementa los no leídos

#### Scenario: Publicación de realtime tras commit
- **WHEN** el sistema termina de ingerir un entrante o un cambio de estado de entrega y confirma el commit
- **THEN** publica el evento correspondiente en `notify_inbox:org.<orgId>` y, si aplica, en `notify_inbox:conv.<conversationId>`

#### Scenario: Fallo de publicación no rompe el webhook
- **WHEN** la publicación a Centrífugo falla tras una ingesta confirmada
- **THEN** el webhook responde con éxito (la ingesta ya está persistida) y el fallo de publicación se registra sin propagarse

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

El sistema SHALL calcular la ventana de servicio de cada conversación como `last_inbound_at + 24h` y SHALL impedir el envío de **mensajes de servicio** (texto y media no-plantilla) fuera de esa ventana. Dentro de la ventana, el envío de servicio SHALL permitirse. La UI SHALL mostrar el tiempo restante de la ventana en la lista de conversaciones y en el subtítulo del encabezado del chat. La UI NO SHALL mostrar un cartel superior de estado de ventana cuando la ventana esté abierta; el aviso de ventana cerrada y la obligación de usar plantilla SHALL mostrarse únicamente cuando la ventana haya vencido. Una conversación sin `last_inbound_at` (proactiva, sin entrante previo) SHALL tratarse como ventana cerrada.

#### Scenario: Envío de servicio dentro de la ventana
- **WHEN** un agente envía un mensaje de servicio y `ahora ≤ last_inbound_at + 24h`
- **THEN** el sistema permite el envío

#### Scenario: Envío de servicio fuera de la ventana
- **WHEN** un agente intenta enviar un mensaje de servicio y `ahora > last_inbound_at + 24h`
- **THEN** el sistema rechaza la operación e indica que debe usar una plantilla

#### Scenario: Ventana abierta sin cartel superior
- **WHEN** un agente abre una conversación con ventana abierta
- **THEN** la UI muestra el tiempo restante en el subtítulo del encabezado del chat y NO muestra el cartel superior de estado de ventana ni un aviso inferior en el composer

#### Scenario: Ventana vencida con aviso
- **WHEN** un agente abre una conversación con ventana vencida
- **THEN** la UI indica que la ventana está cerrada y que debe usar una plantilla

### Requirement: Envío de mensajes de servicio multimedia

El sistema SHALL permitir enviar, dentro de la ventana de 24h, mensajes de tipo texto, imagen, documento, audio y video a la conversación, a través de Kapso. El media saliente SHALL subirse directamente desde el navegador a un almacenamiento de blobs mediante una URL firmada y enviarse a Kapso por `link`. Tras la confirmación de Kapso, el sistema SHALL actualizar el preview de la conversación y poner los no leídos en cero. La respuesta del envío de servicio SHALL incluir el identificador del mensaje creado (`wamid`) cuando Kapso lo provea, para permitir la reconciliación del eco optimista por id en el cliente.

#### Scenario: Enviar texto
- **WHEN** un agente envía un texto en una conversación con ventana abierta
- **THEN** el sistema lo envía por Kapso y refleja el mensaje saliente en el hilo

#### Scenario: Enviar media grande
- **WHEN** un agente adjunta un archivo (p. ej. un video) que supera el límite de body de la función
- **THEN** el archivo se sube directamente al almacenamiento de blobs por URL firmada y el mensaje se envía a Kapso con el `link` correspondiente

#### Scenario: Mostrar media entrante
- **WHEN** una conversación contiene media entrante
- **THEN** el sistema lo muestra usando la URL de media provista por Kapso, sin duplicar el archivo

#### Scenario: Respuesta con identificador del mensaje
- **WHEN** un agente envía un mensaje de servicio y Kapso confirma con un identificador de mensaje
- **THEN** la respuesta del endpoint incluye el `wamid` del mensaje creado

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

### Requirement: Composer con borrador de adjuntos y caption

El sistema SHALL permitir, dentro de la ventana de servicio de 24h, **adjuntar** un archivo (imagen, video, documento) al composer sin enviarlo de inmediato, mostrándolo como un **borrador** en el área del composer. El texto del input SHALL actuar como **caption** del adjunto. El envío SHALL mandar el media y su caption en una sola acción. El sistema SHALL permitir quitar el adjunto antes de enviar. En esta versión el composer SHALL soportar **un adjunto a la vez**; si se intenta adjuntar más de uno (por pegado o arrastre), el sistema SHALL conservar el primero e informar que solo se adjunta un archivo a la vez.

#### Scenario: Adjuntar sin enviar
- **WHEN** un agente adjunta un archivo desde el selector con la ventana abierta
- **THEN** el sistema lo muestra como borrador en el composer y no lo envía hasta que el agente pulsa enviar

#### Scenario: Caption desde el input
- **WHEN** un agente tiene un archivo adjunto en borrador y escribe texto en el input antes de enviar
- **THEN** el sistema envía el media con ese texto como caption en un solo mensaje

#### Scenario: Quitar el adjunto
- **WHEN** un agente quita el adjunto del borrador antes de enviar
- **THEN** el sistema descarta el archivo y el composer vuelve a su estado de solo texto

#### Scenario: Más de un archivo
- **WHEN** un agente intenta adjuntar más de un archivo a la vez
- **THEN** el sistema conserva el primero e informa que solo se adjunta un archivo a la vez

### Requirement: Grabación y envío de audio desde el composer

El sistema SHALL ofrecer un botón de micrófono en el composer que SHALL mostrarse **únicamente cuando el input de texto está vacío y no hay adjunto en borrador**; cuando hay texto o un adjunto, el botón de micrófono SHALL ocultarse y mostrarse el botón de enviar. Al grabar, el sistema SHALL permitir **detener** la grabación y **previsualizar** el audio resultante antes de enviarlo, con opción de **descartar**. El audio SHALL enviarse como mensaje de audio sin caption. La grabación SHALL estar disponible solo dentro de la ventana de 24h.

#### Scenario: Micrófono visible con input vacío
- **WHEN** un agente abre una conversación con ventana abierta y el input está vacío sin adjunto
- **THEN** el sistema muestra el botón de micrófono en lugar del botón de enviar

#### Scenario: Micrófono oculto al escribir
- **WHEN** el agente escribe texto en el input o tiene un adjunto en borrador
- **THEN** el sistema oculta el micrófono y muestra el botón de enviar

#### Scenario: Previsualizar antes de enviar
- **WHEN** el agente detiene una grabación de audio
- **THEN** el sistema muestra una previsualización reproducible con opción de enviar o descartar, sin enviar automáticamente

#### Scenario: Descartar la grabación
- **WHEN** el agente descarta una grabación previsualizada
- **THEN** el sistema elimina el audio y el composer vuelve a su estado inicial

### Requirement: Entrada de texto multilínea

El sistema SHALL permitir redactar mensajes de varias líneas en el composer. `Enter` SHALL enviar el mensaje; `Shift+Enter` y `Ctrl+Enter` SHALL insertar un salto de línea sin enviar. El área de texto SHALL crecer en alto con el contenido hasta un límite razonable y luego desplazarse internamente.

#### Scenario: Enviar con Enter
- **WHEN** el agente pulsa `Enter` con texto en el input
- **THEN** el sistema envía el mensaje

#### Scenario: Salto de línea
- **WHEN** el agente pulsa `Shift+Enter` o `Ctrl+Enter`
- **THEN** el sistema inserta un salto de línea y no envía el mensaje

### Requirement: Adjuntar archivos pegando o arrastrando

El sistema SHALL permitir adjuntar un archivo al borrador del composer **pegándolo** desde el portapapeles (p. ej. una imagen copiada) o **arrastrándolo y soltándolo** sobre el panel de conversación. Durante el arrastre, el sistema SHALL mostrar una superposición (overlay) que invita a soltar el archivo. Ambos gestos SHALL alimentar el mismo borrador de adjunto y SHALL respetar el límite de un adjunto a la vez. Con la **ventana de 24h cerrada**, el sistema SHALL ignorar el pegado y el arrastre de archivos e informar que solo puede enviarse una plantilla.

#### Scenario: Pegar una imagen
- **WHEN** el agente pega una imagen desde el portapapeles con la ventana abierta
- **THEN** el sistema la adjunta como borrador en el composer en lugar de insertarla como texto

#### Scenario: Arrastrar un archivo
- **WHEN** el agente arrastra un archivo sobre el panel de conversación con la ventana abierta
- **THEN** el sistema muestra un overlay de "soltar para adjuntar" y, al soltar, lo adjunta como borrador

#### Scenario: Arrastre con ventana cerrada
- **WHEN** el agente arrastra o pega un archivo en una conversación con la ventana de 24h cerrada
- **THEN** el sistema no lo adjunta e informa que solo puede enviar una plantilla

### Requirement: Iniciar conversación desde el inbox con selector de contacto

El sistema SHALL permitir iniciar una conversación **desde el inbox** mediante un selector que SHALL permitir **buscar un contacto** por nombre y teléfono, en lugar de teclear el número en crudo. Tras elegir el contacto, el sistema SHALL crear o recuperar la conversación y, si no hay ventana de 24h abierta, SHALL ofrecer el envío de plantilla.

#### Scenario: Buscar y elegir contacto
- **WHEN** un agente abre el inicio de conversación en el inbox y busca un contacto por nombre o teléfono
- **THEN** el sistema muestra los contactos coincidentes y permite elegir uno para iniciar la conversación

#### Scenario: Contacto sin ventana abierta
- **WHEN** el agente inicia la conversación con un contacto que no tiene ventana de 24h abierta
- **THEN** el sistema ofrece enviar una plantilla y no permite mensaje de servicio

### Requirement: Panel de información plegable

El sistema SHALL mantener el panel de información del contacto y de la conversación **oculto por defecto**. El sistema SHALL permitir abrirlo y cerrarlo mediante un clic en el nombre del contacto en la cabecera del hilo o mediante un icono junto al selector de estado de la conversación.

#### Scenario: Oculto por defecto
- **WHEN** un agente abre una conversación
- **THEN** el sistema no muestra el panel de información hasta que el agente lo solicita

#### Scenario: Abrir con el nombre o el icono
- **WHEN** el agente hace clic en el nombre del contacto en la cabecera o en el icono de información
- **THEN** el sistema muestra el panel de información de la conversación

#### Scenario: Cerrar el panel
- **WHEN** el agente vuelve a activar el control de información con el panel visible
- **THEN** el sistema oculta el panel

### Requirement: Scroll moderno en las áreas del inbox

El sistema SHALL presentar las áreas con desplazamiento del inbox (lista de conversaciones, hilo de mensajes y panel de información) con una **barra de desplazamiento tipo overlay**: delgada, superpuesta al contenido y que no ocupa ancho permanente, en lugar de la barra nativa del navegador. El desplazamiento SHALL seguir siendo accesible por teclado y rueda del ratón.

#### Scenario: Barra de scroll superpuesta
- **WHEN** el contenido de un área del inbox excede su alto visible
- **THEN** el sistema muestra una barra de desplazamiento delgada superpuesta al contenido, no la barra nativa del navegador

#### Scenario: Desplazamiento accesible
- **WHEN** el agente se desplaza con la rueda del ratón o el teclado en un área con scroll moderno
- **THEN** el sistema desplaza el contenido con normalidad

### Requirement: Conversación seleccionada persistente y compartible por URL

El inbox SHALL reflejar la conversación abierta en la URL mediante el query param `?c=<conversationId>`, de modo que recargar la página reabra la misma conversación y el enlace pueda compartirse. Al seleccionar una conversación, el sistema SHALL actualizar la URL con `router.replace` (sin acumular historial). Al cargar con `?c` presente, el sistema SHALL resolver la conversación: si pertenece a un número distinto al seleccionado, SHALL cambiar automáticamente al número correspondiente y mostrarla; si el id no existe o no es accesible, SHALL limpiar el parámetro sin romper la vista. La resolución SHALL respetar el aislamiento por organización.

#### Scenario: Recargar mantiene la conversación
- **WHEN** un miembro tiene abierta una conversación y recarga la página
- **THEN** el sistema reabre esa misma conversación leyendo `?c` de la URL

#### Scenario: Enlace a conversación de otro número
- **WHEN** un miembro abre un enlace `?c=<id>` cuya conversación pertenece a un número distinto al seleccionado por defecto
- **THEN** el sistema cambia al número correspondiente y muestra la conversación

#### Scenario: Identificador inexistente
- **WHEN** se carga el inbox con `?c=<id>` que no corresponde a ninguna conversación accesible de la organización
- **THEN** el sistema limpia el parámetro y muestra el inbox sin selección, sin error

#### Scenario: Seleccionar actualiza la URL
- **WHEN** un miembro selecciona una conversación de la lista
- **THEN** la URL pasa a incluir `?c=<id>` mediante reemplazo, sin agregar una entrada nueva al historial

### Requirement: Obtener una conversación por identificador

El sistema SHALL exponer `GET /api/v1/orgs/{orgId}/inbox/conversations/{id}` que devuelve el DTO de la conversación —incluido su `connectionId`— para una conversación de la organización. El acceso SHALL estar aislado por organización y verificar la propiedad de la conexión; SHALL responder 404 cuando la conversación no exista o no pertenezca a la organización.

#### Scenario: Conversación existente
- **WHEN** un miembro solicita `GET .../conversations/{id}` de una conversación de su organización
- **THEN** el sistema devuelve el DTO de la conversación con su `connectionId`

#### Scenario: Conversación ajena o inexistente
- **WHEN** se solicita una conversación que no existe o pertenece a otra organización
- **THEN** el sistema responde 404 sin filtrar datos

### Requirement: Auto-desplazamiento al último mensaje

Al abrir una conversación, el área del hilo SHALL desplazarse automáticamente hasta el último mensaje (el más reciente). Cuando llega un mensaje nuevo a la conversación abierta, el hilo SHALL desplazarse al final para mantenerlo visible.

#### Scenario: Abrir baja al último mensaje
- **WHEN** un miembro abre una conversación con historial
- **THEN** el hilo aparece desplazado hasta el mensaje más reciente, sin desplazamiento manual

#### Scenario: Mensaje nuevo mantiene el final visible
- **WHEN** llega un mensaje nuevo mientras la conversación está abierta
- **THEN** el hilo se desplaza al final para mostrar el mensaje recién llegado

### Requirement: Lista ordenada por última actividad con hora visible

La lista de conversaciones SHALL ordenarse de forma descendente por última actividad (último mensaje enviado o recibido), de modo que la conversación con actividad más reciente quede primera. El sistema SHALL garantizar que el ingreso de un mensaje (entrante o saliente) actualiza la marca de última actividad (`last_message_at`) de la conversación correspondiente, y que la lista refleje el reordenamiento sin requerir recargar. Cada item de la lista SHALL mostrar la hora del último mensaje arriba a la derecha, junto al nombre del contacto.

#### Scenario: Mensaje entrante sube la conversación
- **WHEN** una conversación que no está primera recibe un mensaje entrante
- **THEN** su marca de última actividad se actualiza y la conversación pasa al primer lugar de la lista

#### Scenario: Mensaje saliente sube la conversación
- **WHEN** un agente envía un mensaje en una conversación que no está primera
- **THEN** la conversación pasa al primer lugar de la lista tras el envío

#### Scenario: Hora del último mensaje visible
- **WHEN** un item de la lista tiene un último mensaje registrado
- **THEN** el item muestra la hora de ese mensaje arriba a la derecha, junto al nombre

### Requirement: Fondo del área de chat tipo WhatsApp

El área del hilo de mensajes SHALL usar un color de fondo cálido y diferenciado en los temas claro y oscuro, definido por un token de tema (`--chat-bg`), evitando blanco puro y negro puro y aproximándose al fondo característico de WhatsApp.

#### Scenario: Fondo en tema claro
- **WHEN** el inbox se muestra en tema claro
- **THEN** el área del hilo usa el color cálido definido por `--chat-bg`, no blanco puro

#### Scenario: Fondo en tema oscuro
- **WHEN** el inbox se muestra en tema oscuro
- **THEN** el área del hilo usa el color oscuro definido por `--chat-bg`, no negro puro

### Requirement: Diálogo de plantilla con variables desplazables

El diálogo de envío de plantilla SHALL acomodar plantillas con muchas variables: el contenedor SHALL ser suficientemente ancho y la zona de campos de variables SHALL ser desplazable de forma independiente, manteniendo siempre visibles el encabezado del diálogo y el botón de envío, sin que el contenido se desborde fuera de la pantalla.

#### Scenario: Plantilla con muchas variables
- **WHEN** un agente selecciona una plantilla con suficientes variables como para exceder el alto disponible
- **THEN** los campos de variables se muestran en un área desplazable y el botón de envío permanece visible y accesible

### Requirement: Feedback de cambio de estado y reasignación

Al cambiar el estado o reasignar una conversación, el sistema SHALL dar feedback inmediato al usuario que ejecuta la acción mediante una notificación (toast) y una animación sutil, sin recurrir a sondeo periódico para detectar cambios de otros usuarios. Al **reasignar** una conversación a otro agente, la lista SHALL revalidarse de modo que, si el filtro activo es "mis conversaciones", la conversación deje de mostrarse. Al **cambiar el estado**, la conversación SHALL permanecer visible en el hilo abierto (no se saca de la vista ni se navega a otra parte).

#### Scenario: Confirmación al cambiar estado
- **WHEN** un agente cambia el estado de la conversación abierta
- **THEN** el sistema muestra un toast de confirmación y una animación sutil, y la conversación permanece visible

#### Scenario: Reasignar a otro agente actualiza la lista
- **WHEN** un agente reasigna a otro usuario una conversación mientras el filtro activo es "mis conversaciones"
- **THEN** el sistema muestra feedback de la acción y la conversación deja de aparecer en la lista filtrada

### Requirement: Presentación de la lista de conversaciones

La lista de conversaciones SHALL comunicar de un vistazo el estado de cada
conversación. El borde del avatar de cada item SHALL reflejar el estado de negocio
de la conversación con un anillo fino: verde para abierta, ámbar para pendiente y
gris para cerrada. Cada item SHALL mostrar arriba a la derecha la marca de tiempo
de la última actividad (último mensaje entrante o saliente; en su defecto, el
último entrante) con formato relativo (hora si es hoy, "Ayer", día de la semana en
los últimos 7 días, o fecha corta si es más antiguo); si no hay actividad
registrada, no muestra marca. Esa marca de tiempo SHALL exponer la fecha y hora
completas mediante un `title` nativo (tooltip). Cuando la conversación tenga
mensajes sin leer, el nombre y el texto de preview SHALL mostrarse en negrita,
además del indicador numérico existente. El texto de preview SHALL truncarse con
puntos suspensivos cuando exceda el ancho disponible y SHALL exponer su contenido
completo mediante un `title` nativo (tooltip). Cada item SHALL mostrar, en la
segunda línea a la derecha, el tiempo restante de la ventana de 24 horas; cuando la
ventana haya vencido, SHALL mostrar en su lugar un indicador discreto de ventana
cerrada (ícono de reloj en rojo). El tiempo restante mostrado SHALL refrescarse de
forma autónoma al menos cada 60 segundos, con independencia de la llegada de datos
nuevos.

#### Scenario: Borde del avatar según el estado
- **WHEN** se pinta un item de la lista
- **THEN** el avatar muestra un anillo fino verde si la conversación está abierta, ámbar si está pendiente y gris si está cerrada

#### Scenario: Tooltip de fecha y hora completa
- **WHEN** el usuario sitúa el puntero sobre la marca de tiempo de un item con actividad
- **THEN** se muestra un `title` con la fecha y hora completas de la última actividad

#### Scenario: Conversación con mensajes sin leer
- **WHEN** una conversación de la lista tiene `unreadCount > 0`
- **THEN** su nombre y su texto de preview se muestran en negrita y conserva el indicador numérico de no leídos

#### Scenario: Texto de preview truncado
- **WHEN** el texto del último mensaje excede el ancho disponible del item
- **THEN** el texto se recorta con puntos suspensivos y su contenido completo queda disponible en el `title` (tooltip) del elemento

#### Scenario: Restante de ventana en el item
- **WHEN** una conversación tiene la ventana de 24 horas abierta
- **THEN** el item muestra el tiempo restante de la ventana en la segunda línea, a la derecha

#### Scenario: Ventana vencida en el item
- **WHEN** una conversación tiene la ventana de 24 horas vencida
- **THEN** el item no muestra tiempo restante y muestra en su lugar un ícono de reloj en rojo (sin borde rojo en el avatar)

#### Scenario: Refresco autónomo del restante
- **WHEN** transcurre el tiempo sin que lleguen datos nuevos
- **THEN** el tiempo restante mostrado se actualiza al menos cada 60 segundos

### Requirement: Encabezado del chat con panel de información conmutable

El encabezado del área de chat SHALL permitir alternar la visibilidad del panel
derecho de información. Toda el área compuesta por el avatar, el nombre y el
número del contacto SHALL ser clicable y SHALL alternar dicho panel.

#### Scenario: Alternar el panel desde el área del contacto
- **WHEN** un agente hace clic en el área de avatar, nombre o número del encabezado del chat
- **THEN** el panel derecho de información se muestra si estaba oculto y se oculta si estaba visible

### Requirement: Eco optimista de mensajes salientes

Al enviar un mensaje de servicio, la UI SHALL mostrar de inmediato una burbuja
optimista en el hilo, antes de la confirmación del servidor, con un pseudo-estado
`sending` que SHALL representarse con un ícono de reloj en lugar del primer check.
Cuando el mensaje real (read-through de Kapso) aparezca en el hilo, la UI SHALL
reconciliar la burbuja optimista con el mensaje real por su `wamid` sin generar
duplicados. Si el envío falla, la UI SHALL revertir la burbuja optimista e indicar
el error.

#### Scenario: Eco inmediato con reloj
- **WHEN** un agente envía un mensaje de servicio
- **THEN** la burbuja aparece de inmediato en el hilo con un ícono de reloj y sin el primer check

#### Scenario: Reconciliación por wamid
- **WHEN** el mensaje real correspondiente llega del hilo con el mismo `wamid` devuelto por el envío
- **THEN** la UI sustituye la burbuja optimista por el mensaje real sin duplicarlo

#### Scenario: Fallo de envío
- **WHEN** el envío del mensaje falla
- **THEN** la UI revierte la burbuja optimista e informa del error al agente


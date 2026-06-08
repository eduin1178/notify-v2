## ADDED Requirements

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

## MODIFIED Requirements

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

## ADDED Requirements

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

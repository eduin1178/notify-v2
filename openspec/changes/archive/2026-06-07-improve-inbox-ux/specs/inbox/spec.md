## ADDED Requirements

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

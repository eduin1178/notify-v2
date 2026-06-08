## ADDED Requirements

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

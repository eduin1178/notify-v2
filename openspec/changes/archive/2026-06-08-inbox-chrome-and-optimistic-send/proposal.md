## Why

La bandeja del inbox ya funciona, pero su "chrome" todavía obliga al agente a
adivinar información que WhatsApp muestra de un vistazo: no distingue visualmente
las conversaciones con mensajes sin leer, recorta el último mensaje sin dejar
verlo completo, y no comunica cuánto queda de la ventana de 24 horas en la lista.
Además, el envío de un mensaje espera el viaje completo al servidor antes de
reflejarse, lo que se siente lento frente a la respuesta inmediata de WhatsApp.
Este change pule esa capa visual y añade eco optimista, sin tocar realtime
(Centrífugo va en un change aparte).

## What Changes

- **Lista de conversaciones**: el nombre y el último mensaje se muestran en
  negrita cuando hay mensajes sin leer; el último mensaje truncado expone su
  contenido completo en un `title` (tooltip nativo); cada item muestra en la
  segunda línea, a la derecha, el tiempo restante de la ventana de 24 horas, y el
  avatar adopta un borde rojo cuando la ventana ya venció. El restante se refresca
  con un "tick" propio cada 60 segundos (no depende de la llegada de datos).
- **Encabezado del chat**: toda el área de avatar + nombre + número pasa a ser
  clicable para alternar el panel derecho de información. Se elimina el cartel
  superior de estado de ventana y el aviso inferior del composer cuando la
  ventana está abierta; el aviso de "ventana cerrada / usar plantilla" se
  conserva solo cuando la ventana venció. El tiempo restante de la ventana se
  muestra ahora de forma discreta en el subtítulo del encabezado del chat.
- **App-shell en `/inbox`**: se elimina el header global superior únicamente en la
  ruta del inbox; el control de expandir/contraer el sidebar (`SidebarTrigger`)
  se reubica integrado en la barra de la lista de conversaciones.
- **Envío optimista**: al enviar un mensaje aparece de inmediato una burbuja con
  un pseudo-estado `sending` que muestra un reloj (en lugar del primer check),
  reconciliada con el mensaje real (read-through de Kapso) por id sin duplicados.
- **BREAKING (contrato REST)**: el endpoint `POST /orgs/:orgId/inbox/conversations/:id/messages`
  pasa de devolver `ConversationDto` a devolver también el `wamid` del mensaje
  recién creado (el servicio ya lo tiene en `result.messageId`), necesario para la
  reconciliación optimista por id.

## Capabilities

### New Capabilities
<!-- Ninguna nueva capability: este change modifica comportamiento de capabilities existentes. -->

### Modified Capabilities
- `inbox`: cambian requisitos de presentación de la lista (no leídos en negrita,
  tooltip de texto truncado, restante de ventana + borde rojo de avatar), del
  encabezado del chat (área clicable, eliminación de carteles de ventana,
  restante en el subtítulo), y del contrato de envío de mensajes de servicio (la
  respuesta incluye el `wamid`) junto con el comportamiento de eco optimista en la
  UI.
- `app-shell`: el header global superior deja de renderizarse en la ruta
  `/inbox` y el `SidebarTrigger` se reubica fuera de ese header.

## Impact

- **Código (UI)**: `web/components/app/inbox-client.tsx` (lista, encabezado,
  burbuja/estado de entrega, eco optimista), `web/components/app/inbox/composer.tsx`
  (eliminación del aviso inferior con ventana abierta, integración del eco),
  `web/components/app/app-shell.tsx` (header condicional + reubicación del trigger).
- **Código (API/servicio)**: `web/lib/services/inbox/schemas.ts` (schema de
  respuesta del envío de servicio con `wamid`), `web/lib/api/routes/v1/orgs/inbox.ts`
  (respuesta del `sendMessageRoute`), y `web/components/app/inbox/send-helpers.ts`
  si el envío necesita devolver el cuerpo de la respuesta.
- **Contrato REST**: cambia la forma de respuesta de un endpoint existente
  (aditivo: se añade `wamid`); el cliente tipado de `hono/client` lo recoge sin
  codegen.
- **Sin dependencias nuevas, sin migraciones de BD.** No incluye Centrífugo ni
  ningún transporte realtime.

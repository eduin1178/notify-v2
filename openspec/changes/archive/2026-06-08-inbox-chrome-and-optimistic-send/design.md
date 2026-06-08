## Context

El inbox vive en [inbox-client.tsx](web/components/app/inbox-client.tsx) (un
client component grande que orquesta lista, hilo, encabezado, diálogos y estado),
con el composer en [composer.tsx](web/components/app/inbox/composer.tsx) y el shell
en [app-shell.tsx](web/components/app/app-shell.tsx). Los datos llegan por SWR con
`refreshInterval: 4000` para conversaciones e hilo; el hilo es **read-through de
Kapso** (la respuesta no contiene mensajes propios hasta que Kapso los devuelve).
El endpoint de envío (`sendMessageRoute` en
[inbox.ts](web/lib/api/routes/v1/orgs/inbox.ts)) hoy responde `ConversationDto`; el
servicio ya calcula `result.messageId` (el `wamid`) en
[service.ts](web/lib/services/inbox/service.ts) pero no lo expone.

Restricciones del proyecto que condicionan el diseño:
- La capa `lib/services/` es **pura** (sin `next/*`, sin Hono): el cambio de
  contrato del endpoint se hace en el schema de respuesta y la ruta, no con I/O
  nuevo en el servicio.
- ESLint del proyecto prohíbe `setState`/asignación de `ref` durante render o en
  el cuerpo de efectos sin guardas (patrón ya visible en el manejo de `?c` y
  `?startContact`). El "tick" de 60s y el eco optimista deben respetarlo.
- Copy de usuario en español neutro (tú), sin voseo.

## Goals / Non-Goals

**Goals:**
- Pulir la presentación de la lista (negrita en no leídos, tooltip de preview,
  restante de ventana, borde rojo de avatar vencido) con refresco autónomo del
  restante.
- Encabezado del chat con área de contacto clicable que alterna el panel derecho;
  eliminar carteles de ventana redundantes; mover el restante al subtítulo.
- Quitar el header global solo en `/inbox` y reubicar el `SidebarTrigger` en la
  barra de la lista.
- Eco optimista del envío con reloj y reconciliación por `wamid`.

**Non-Goals:**
- Centrífugo / realtime por WebSocket (change aparte).
- Unificación de hilos por número (idea pendiente en `ideas.md`).
- Cambios en el modelo de datos o migraciones.
- Cambiar la cadencia del polling de SWR (se mantiene 4s en este change).

## Decisions

### D1 — Restante de ventana: helper de formato + "tick" de 60s
`fmtRemaining` ya existe en [inbox-client.tsx:100](web/components/app/inbox-client.tsx#L100).
Para que el restante avance sin datos nuevos, se introduce un `useState` "now"
actualizado por un único `setInterval(60000)` a nivel de `InboxClient`, usado tanto
por los items de la lista como por el subtítulo del encabezado. Se prefiere un solo
intervalo en el contenedor (no uno por item) para no multiplicar timers.
**Alternativa descartada**: recalcular solo en cada poll de SWR → el restante se
congela hasta el siguiente fetch.

### D2 — Borde rojo del avatar como señal de ventana vencida
El avatar de la lista usa `Avatar` de shadcn. La ventana vencida se deriva de
`!conv.windowOpen` (el DTO ya trae `windowOpen` y `windowClosesAt`). El borde rojo
se aplica con una clase condicional (`ring`/`border` en rojo) sobre el `Avatar`.
**Alternativa descartada**: un ícono extra → más ruido visual; el usuario propuso
explícitamente el borde del círculo.

### D3 — Negrita de no leídos y tooltip
Negrita condicional (`font-semibold`/`font-bold`) en nombre y preview cuando
`conv.unreadCount > 0`. Tooltip nativo con `title={conv.lastMessageText ?? ""}` en
el `<span>` truncado del preview (nativo, sin componente Tooltip, coherente con que
`title` es lo pedido y evita overhead de portal por item).

### D4 — Encabezado del chat: área de contacto clicable + carteles
El botón clicable se extiende para envolver también el avatar (hoy solo envuelve
nombre+número en [663-675](web/components/app/inbox-client.tsx#L663-L675)). Se elimina el
bloque de cartel de ventana [714-729](web/components/app/inbox-client.tsx#L714-L729); el
restante (D1) pasa al subtítulo bajo el número. El composer
([composer.tsx:56-73](web/components/app/inbox/composer.tsx#L56-L73)) conserva el bloque de
"ventana cerrada / enviar plantilla" pero solo se renderiza cuando
`!conversation.windowOpen` (ya es el caso); se elimina cualquier aviso inferior
cuando la ventana está abierta. El botón `InfoIcon` dedicado se conserva como
control explícito redundante con el área clicable.

### D5 — Header global condicional por ruta + reubicación del trigger
[app-shell.tsx](web/components/app/app-shell.tsx) ya calcula `fullBleed` con
`pathname?.endsWith("/inbox")`. Se reutiliza esa señal para **no renderizar** el
`<header>` global cuando `fullBleed`. El `SidebarTrigger` se pasa al inbox y se
integra en la barra de filtros de la lista (junto al selector de número en
[465-504](web/components/app/inbox-client.tsx#L465-L504)).
**Alternativa descartada**: trigger flotante `absolute` → puede tapar contenido y es
menos descubrible (decisión del usuario: integrarlo en la barra de la lista).

### D6 — Contrato del endpoint de envío: añadir `wamid`
Se extiende el schema de respuesta del `sendMessageRoute` para devolver, junto al
`ConversationDto`, el `wamid` del mensaje creado (ya disponible en
`result.messageId`). Cambio **aditivo** (no rompe consumidores que ignoran el
campo). El cliente tipado de `hono/client` lo recoge sin codegen.
**Alternativa descartada**: devolver el `MessageDto` completo → el servicio no
materializa el mensaje (read-through), solo tiene el `wamid`; devolver el id es
suficiente para reconciliar.

### D7 — Eco optimista por capa cliente sobre el SWR del hilo
El hilo es read-through, así que el optimista no puede vivir dentro del cache de
SWR como dato autoritativo. Se mantiene una lista de "optimistas pendientes" en
estado de `InboxClient`, indexada por `wamid` devuelto por el envío. El render del
hilo concatena `messages` (SWR) + optimistas cuyo `wamid` aún no aparece en
`messages`. Al detectar el `wamid` real en el SWR, se descarta el optimista
(reconciliación por id). Pseudo-estado `sending` → `ClockIcon` añadido en
`DeliveryStatus` ([1767](web/components/app/inbox-client.tsx#L1767)), distinto de `pending`.
Antes de tener `wamid` (ventana entre clic y respuesta del POST), el optimista usa
un id temporal; al volver el POST con `wamid`, se reetiqueta.
**Alternativa descartada**: insertar el optimista en el cache de SWR con
`mutate(..., {optimisticData})` → al revalidar contra Kapso (que aún no lo tiene)
desaparecería y reaparecería (parpadeo); peor sin un id estable para casar.

## Risks / Trade-offs

- **Reconciliación por `wamid`**: si Kapso devuelve `messageId = null` (no
  confirma id) → no hay clave para casar. **Mitigación**: si no hay `wamid`,
  mantener el optimista hasta el primer refetch posterior al envío y luego
  descartarlo por heurística (mismo texto + saliente + ventana temporal corta),
  aceptando un parpadeo poco frecuente solo en ese caso límite.
- **Ventana entre clic y respuesta del POST**: el optimista nace sin `wamid`.
  **Mitigación**: id temporal local; reetiquetar al recibir la respuesta.
- **Quitar el header global en `/inbox`**: el `SidebarTrigger` podría quedar poco
  visible. **Mitigación**: ubicarlo fijo en la barra de la lista, siempre visible
  con la columna izquierda.
- **Tick de 60s**: un `setInterval` mal limpiado fuga timers. **Mitigación**:
  `useEffect` con cleanup; un solo intervalo en el contenedor.
- **Lint de efectos**: el eco y el tick deben evitar `setState` síncrono en
  render/efecto. **Mitigación**: seguir el patrón ya usado para `?c`/`?startContact`
  (guardas y `setState` tras `await`/dentro de callbacks de timer).

## Migration Plan

Cambio puramente aditivo y de presentación; sin migraciones de datos. Despliegue
estándar. El único cambio de contrato (`wamid` en la respuesta del envío) es
aditivo: desplegar backend y frontend juntos, pero un frontend viejo seguiría
funcionando (ignora el campo). Rollback = revertir el commit; sin estado
persistente que limpiar.

## Open Questions

- Ninguna bloqueante. (El comportamiento ante `wamid` nulo queda resuelto por la
  mitigación de D7/Risks; si en `apply` se observa que Kapso siempre devuelve id,
  se puede simplificar eliminando la heurística de respaldo.)

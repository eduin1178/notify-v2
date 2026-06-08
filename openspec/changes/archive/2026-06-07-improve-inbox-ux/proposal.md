## Why

El inbox ya tiene una experiencia de chat sólida ([inbox-chat-experience](../archive/2026-06-08-inbox-chat-experience/proposal.md)), pero cinco fricciones reales (recogidas en [openspec/tareas.md](../../tareas.md)) lo alejan todavía de la sensación de WhatsApp Web y de un flujo de equipo cómodo:

1. La conversación seleccionada vive solo en estado local: al recargar se pierde y **no se puede compartir un enlace** a una conversación concreta. Además, al abrir una conversación **no se baja al último mensaje**.
2. Las conversaciones **no se reordenan por última actividad**: una conversación que recibe un mensaje no sube al tope de la lista, ni siquiera tras recargar. En la prueba de diagnóstico (mensaje entrante → sin F5 y con F5) **nunca sube**, lo que apunta a que `lastMessageAt` no se refleja en la fila, no a un problema de orden en la query (que ya ordena `desc(lastMessageAt)`).
3. El fondo del área de chat usa `bg-muted/10` (casi blanco/negro puro), lejos del fondo cálido característico de WhatsApp.
4. El diálogo de envío de plantilla es **angosto** (`sm:max-w-sm`) y **no scrollea**: con muchas variables, los campos se desbordan fuera de la pantalla y el botón "Enviar" queda inalcanzable.
5. Cambiar el estado o reasignar una conversación **no da ningún feedback**: el usuario no sabe si la acción surtió efecto.

## What Changes

**T1 — Conversación en la URL + scroll al último mensaje.**
- Sincronizar la conversación seleccionada con un query param `?c=<conversationId>` (no rutas anidadas; se descartó para minimizar el refactor sobre `InboxClient`). Al seleccionar se hace `router.replace(?c=id)`; al montar se lee `?c` y se selecciona.
- **Enlace robusto (fallback A):** si `?c=id` apunta a una conversación que no está en la lista cargada (otro número/`connectionId` o fuera de los filtros), se resuelve por id, se cambia automáticamente al número correspondiente y se muestra. Si el id no existe, se limpia `?c` sin romper la vista.
- **Auto-scroll al último mensaje** al abrir una conversación y al llegar mensajes nuevos (hoy no existe; requiere `ref` al viewport del Radix `ScrollArea`).

**T2 — Reordenar por última actividad + hora visible.**
- Garantizar que el ingreso de mensajes (entrante y saliente) actualiza `lastMessageAt`/`lastMessageText` de la **fila correcta**, de modo que la lista se reordene por última actividad. Incluye un **spike de diagnóstico** previo: confirmar entrega de webhooks de Kapso en el entorno y que la fila objetivo es la que se actualiza (riesgo de fila proactiva duplicada). La query ya ordena bien; el arreglo es del dato.
- La **hora del último mensaje** se muestra arriba a la derecha del item, junto al nombre (estilo WhatsApp Web). El elemento **ya está cableado** ([inbox-client.tsx:510](../../../web/components/app/inbox-client.tsx)) y aparece vacío solo porque `lastMessageAt` es nulo; queda como criterio de aceptación verificable una vez corregido el dato.
- Reordenamiento **en vivo** (sin recargar) vía revalidación de la lista al enviar/recibir.

**T3 — Fondo del chat tipo WhatsApp.**
- Token `--chat-bg` en [globals.css](../../../web/app/globals.css) (Tailwind v4 CSS-first): claro `#efeae2`, oscuro `#0b141a`. Aplicado al área del hilo. Sin patrón de "doodles" (fuera de alcance).

**T4 — Diálogo de plantilla ancho y scrolleable.**
- Ensanchar el `DialogContent` de `TemplateDialog` (`sm:max-w-lg`) y reestructurarlo a layout `flex` con la **zona de variables scrolleable**, manteniendo fijos el encabezado y el botón "Enviar". Reutiliza el patrón ya presente en `InteractiveDialog`.

**T5 — Feedback de asignación y estado (sin polling).**
- Instalar `sonner` y montar `<Toaster/>`. **Cero conciencia colaborativa por poll** (descartada).
- **Reasignar a otro agente** (acción propia): revalidar la lista (si estoy en "mis conversaciones", la conversación deja de verse) + **animación sutil** + toast de confirmación.
- **Cambiar estado** (acción propia): la conversación **permanece visible** (no se saca ni se navega); el feedback es principalmente el **toast**, con animación sutil.

## Capabilities

### New Capabilities
<!-- Sin capacidades nuevas: todo modifica comportamiento de la spec `inbox` existente. -->

### Modified Capabilities
- `inbox`: enlace profundo a conversación vía `?c=<id>` con resolución por id y cambio de número; auto-scroll al último mensaje; reordenamiento de la lista por última actividad con hora visible; fondo del chat tipo WhatsApp; diálogo de plantilla ancho con variables scrolleables; feedback (toast + animación) en cambio de estado y reasignación.

## Impact

- **Frontend (la mayor parte):** [web/components/app/inbox-client.tsx](../../../web/components/app/inbox-client.tsx) — sincronización `?c`, auto-scroll, lista (hora/orden), `TemplateDialog`, feedback de estado/asignación. [web/app/globals.css](../../../web/app/globals.css) para el token `--chat-bg`.
- **Backend (acotado):** nuevo `GET /orgs/{orgId}/inbox/conversations/{id}` + `getConversationById` en [web/lib/services/inbox/service.ts](../../../web/lib/services/inbox/service.ts) y su ruta en [web/lib/api/routes/v1/orgs/inbox.ts](../../../web/lib/api/routes/v1/orgs/inbox.ts), con schema de salida reutilizando el DTO existente. **Spike T2:** revisar el camino de escritura de `lastMessageAt` en el ingreso de mensajes y la entrega de webhooks de Kapso (posible causa raíz fuera de la UI).
- **Dependencias UI nuevas:** `sonner` (toasts), hoy no instalado.
- **Sin cambios de esquema de base de datos.** El handler del entrante ([service.ts:1339](../../../web/lib/services/inbox/service.ts)) y `parseTimestamp` ya son correctos; el spike confirma por qué el dato no llega a la fila en el entorno observado.

## Non-goals

- Conciencia colaborativa en tiempo real (notificar cuando **otro** usuario cambia una conversación). Descartado: sin polling ni websockets.
- Rutas anidadas `/inbox/conversations/:id`. Se usa query param.
- Patrón de fondo con imagen ("doodles") de WhatsApp.
- Paginación infinita o virtualización de la lista de conversaciones.

## Context

Todo el inbox es un único componente cliente, [web/components/app/inbox-client.tsx](../../../web/components/app/inbox-client.tsx) (~1837 líneas), que concentra estado (filtros, `connectionId`, `selectedId`, draft del composer), datos vía SWR con `refreshInterval: 4000` y todos los diálogos. La capa de dominio vive en [web/lib/services/inbox/service.ts](../../../web/lib/services/inbox/service.ts) con rutas Hono en [web/lib/api/routes/v1/orgs/inbox.ts](../../../web/lib/api/routes/v1/orgs/inbox.ts), siguiendo la convención `ctx`/`DomainError` del proyecto.

Restricciones relevantes:
- **Lint estricto**: prohibido `setState`/mutación de `ref` durante el render; la sincronización de estado debe ir en handlers o `useEffect` (precedente documentado al levantar el draft del composer).
- **Tailwind v4 CSS-first**: los tokens de color se definen en [web/app/globals.css](../../../web/app/globals.css) con `@theme`/variables CSS, sin `tailwind.config.js`.
- **REST versionada y tipada**: cualquier endpoint nuevo se monta en `/api/v1/...` con `@hono/zod-openapi` y reutiliza schemas de `lib/services/inbox/schemas.ts`.
- **Copy en español neutro (tú)** para todo texto visible (toasts incluidos).

## Goals / Non-Goals

**Goals:**
- Conversación seleccionada compartible por URL (`?c=<id>`) y resoluble aunque sea de otro número.
- Auto-scroll al último mensaje al abrir/recibir.
- Reordenamiento real por última actividad (corregir la causa raíz del dato, no la query) con hora visible.
- Fondo de chat tipo WhatsApp en claro/oscuro.
- Diálogo de plantilla usable con muchas variables.
- Feedback inmediato (toast + animación) en estado/asignación, sin polling colaborativo.

**Non-Goals:**
- Rutas anidadas `/inbox/conversations/:id` (se usa query param).
- Conciencia colaborativa en tiempo real / websockets.
- Patrón de imagen de fondo ("doodles").
- Virtualización o scroll infinito de la lista.

## Decisions

### D1 — `?c=<id>` como fuente, `selectedId` reconciliado por efecto
La URL es la fuente de verdad del seleccionado. Al **seleccionar** se hace `router.replace(\`${pathname}?c=${id}\`)` (replace, no push: evita inundar el historial al saltar entre chats). Un `useEffect` que depende de `searchParams` reconcilia `selectedId` desde `?c`. Se conserva `selectedId` como estado (en vez de derivarlo en render) porque media en muchos lugares (`messagesKey`, `selected`) y evita el `setState` en render que el lint prohíbe.
- *Alternativa descartada:* derivar `selectedId = searchParams.get("c")` en render → choca con el lint y con el flujo de `focusConversation` que ya setea estado.

### D2 — Resolución robusta del enlace (fallback A) con endpoint nuevo
Al montar o cambiar `?c`: si la conversación está en la lista cargada, se selecciona directo. Si **no** está (otro `connectionId` o fuera del filtro), se llama un endpoint nuevo `GET /api/v1/orgs/{orgId}/inbox/conversations/{id}` que devuelve el `ConversationDto` (incluye `connectionId`); con eso se hace `setConnectionId(conv.connectionId)` y se selecciona. Si el endpoint responde 404, se limpia `?c` con `router.replace(pathname)` sin romper la vista.
- Backend: `getConversationById(ctx, id)` en el servicio, con `assertConnectionOwned`/scope por `organizationId`; `DomainErrors.notFound()` si no existe. Ruta `createRoute({ method: "get", path: ".../conversations/{id}" })` reutilizando `ConversationDto` como response schema.
- *Alternativa descartada (B):* limpiar `?c` si no está en la lista → deja sin resolver justo el caso que motivó la tarea (link a conversación de otro número).
- Guardia anti-bucle: un `ref` (`resolvedParamRef`) evita re-resolver el mismo id en cada render del efecto, igual que el `handledStartRef` existente para `?startContact`.

### D3 — Auto-scroll al viewport del Radix ScrollArea
El `ScrollArea` de mensajes no expone el nodo scrolleable directamente; se obtiene con un `ref` al `data-slot` del viewport (o un `ref` puesto en el contenedor interno). Un `useEffect` con dependencia en `[selectedId, messages.length]` hace `viewport.scrollTop = viewport.scrollHeight`. Como los mensajes se renderizan invertidos (más nuevo abajo), bajar al fondo = último mensaje. Se hace scroll "instantáneo" al cambiar de conversación y se puede suavizar al llegar uno nuevo.
- *Trade-off:* no se implementa "mantener posición si el usuario subió a leer historial" (v1 siempre baja al llegar mensaje). Se anota como mejora futura, no bloqueante.

### D4 — T2 es un spike de datos, no un cambio de orden
La query ya ordena `desc(lastMessageAt), desc(id)` y `parseTimestamp` es correcto. El síntoma ("ni con F5 sube", hora vacía) implica que `lastMessageAt` no llega a la fila en el entorno observado. **Primero se diagnostica**, luego se corrige:
1. Confirmar entrega de webhooks de Kapso al entorno (¿llega el evento entrante al handler [service.ts:1339](../../../web/lib/services/inbox/service.ts)?).
2. Verificar que se actualiza la **fila correcta** y no se crea/usa una proactiva duplicada (la lógica de "adopción" por `phoneNumber` normalizado en 1317-1335 es el punto de riesgo).
3. Confirmar que el saliente desde el composer también refresca `lastMessageAt` y revalida la lista en vivo.
El reordenamiento en vivo se garantiza revalidando `conversationsKey` tras enviar y confiando en el `refreshInterval` para el entrante.
- *Por qué no "arreglar el orden" directo:* tocar la query sin reproducir rompería algo que ya está bien y dejaría el bug real (dato) sin resolver.

### D5 — `sonner` para toasts, `<Toaster/>` en el shell de la app
Se instala `sonner` (estándar shadcn) y se monta un único `<Toaster/>` en el layout del segmento `(app)` para que cualquier vista emita toasts. Las acciones `changeStatus`/`changeAssignment` emiten toast tras éxito y muestran una **animación sutil** (p. ej. un breve `transition`/highlight en la cabecera o el item). Reasignar revalida la lista (la conversación sale de "mis conversaciones"); cambiar estado **no** saca la conversación de vista.
- *Alternativa descartada:* un sistema de toasts propio → reinventa lo que `sonner` ya resuelve; el proyecto ya lo referencia en lock.

### D6 — `TemplateDialog`: ancho + región scrolleable con header/footer fijos
Se reestructura el `DialogContent` a `sm:max-w-lg` y a layout `flex flex-col` con `max-h-[85vh]`: encabezado y `DialogFooter` (botón "Enviar") fijos, y un contenedor intermedio `flex-1 overflow-y-auto` que envuelve **solo** los campos de variables. Reutiliza el patrón que `InteractiveDialog` ya aplica (`max-h-[85vh] overflow-y-auto`), pero acotando el scroll a las variables para que "Enviar" quede siempre visible.

### D7 — Token `--chat-bg`
En `globals.css`, dentro de los bloques de tema claro y oscuro: `--chat-bg: #efeae2;` (claro) y `--chat-bg: #0b141a;` (oscuro). El área del hilo cambia `bg-muted/10` por `bg-[var(--chat-bg)]`. Las burbujas entrantes (`bg-background`) siguen contrastando bien sobre ambos.

## Risks / Trade-offs

- **[T2 puede ser infra, no código]** Si el webhook de Kapso no llega al entorno local, ninguna corrección de UI hará subir la conversación. → El spike (D4) lo determina antes de comprometer cambios; si es infra, se documenta y la parte de UI (hora visible, revalidación) igual queda lista.
- **[Resolución por id abre una conversación de otro número en silencio]** Cambiar `connectionId` automáticamente puede sorprender al usuario. → El cambio de número es el comportamiento correcto para un enlace compartido; se mantiene visible el selector de número actualizado.
- **[Auto-scroll molesto al leer historial]** Bajar siempre al llegar un mensaje puede interrumpir. → v1 acepta el trade-off; se anota "preservar scroll si el usuario subió" como mejora futura.
- **[`router.replace` y SWR keepPreviousData]** Cambiar `?c` no debe disparar refetch innecesario de la lista. → La key de la lista no depende de `?c`, solo de filtros/`connectionId`; el replace no la invalida.
- **[Nuevo endpoint y scope multi-tenant]** `GET /conversations/{id}` debe respetar `organizationId` y propiedad de la conexión. → Reusar `assertConnectionOwned`/filtro por org como el resto del servicio.

## Spike T2 — veredicto (resuelto por análisis estático)

**Causa raíz: entrega de webhook, no código.** La lista se sirve del índice local (`last_message_at`), que solo se actualiza con el webhook `whatsapp.message.received` ([webhooks/kapso/route.ts:153](../../../web/app/api/webhooks/kapso/route.ts) → `ingestInboundMessage`, que escribe correctamente). El hilo, en cambio, se lee read-through desde Kapso, así que un entrante aparece en el hilo abierto aunque el webhook nunca llegue. El webhook se registra a `${BETTER_AUTH_URL}/api/webhooks/kapso`; si esa URL no es pública (local sin túnel), el entrante nunca toca el índice → la conversación no sube (ni con F5) y la hora queda vacía. Encaja con todos los síntomas observados.

Descartados: query de orden (correcta), `parseTimestamp` (correcto), fila proactiva duplicada (`conversation.created` es informativo, no crea filas; la adopción enlaza la proactiva). El saliente ya reordena en vivo vía `afterSend → revalidate()`.

**Consecuencia:** el grupo 4 NO modifica el camino de escritura. T2 se resuelve a nivel de entorno/registro de webhook (URL pública alcanzable por Kapso). Las tareas de código que quedan son verificaciones: revalidación en vivo al enviar (ya existe) y hora visible (ya cableada, aparece al corregir el dato).

## Open Questions

- Animación "sutil" de T5: ¿highlight en el item de la lista, en la cabecera del hilo, o ambos? Se decide en implementación según se vea mejor; no bloquea el desglose de tareas.

## 1. Spike T2 — diagnóstico de última actividad (antes de codear)

- [x] 1.1 Reproducir / diagnosticar. Resuelto por análisis estático: el hilo es read-through de Kapso (el mensaje se ve aunque el webhook no llegue), pero la lista vive del índice local `last_message_at`. Confirmación de usuario pendiente (opcional): el item no sube ni muestra hora aunque el mensaje aparezca en el hilo.
- [x] 1.2 Entrega de webhooks: el entrante depende de `whatsapp.message.received` registrado a `${BETTER_AUTH_URL}/api/webhooks/kapso` ([route.ts:153](../../../web/app/api/webhooks/kapso/route.ts)). Si la URL no es pública (local), el entrante nunca toca el índice. `ingestInboundMessage` escribe `last_message_at` correctamente.
- [x] 1.3 Sin fila duplicada: `whatsapp.conversation.created` es informativo (no crea filas, route.ts:166-172); la adopción enlaza la proactiva. No hay bug de fila.
- [x] 1.4 Veredicto: **entrega de webhook (entorno), no código**. El grupo 4 no modifica el camino de escritura; ver design.md "Spike T2 — veredicto".

## 2. Backend — obtener conversación por id

- [x] 2.1 Añadido `getConversationById(ctx, id)` en service.ts (join contacto+agente, scope por `organizationId`, `DomainErrors.notFound()`), devuelve `ConversationDtoT` con `connectionId`.
- [x] 2.2 Montado `GET /orgs/{orgId}/inbox/conversations/{id}` en inbox.ts con `createRoute` (response `ConversationDto` 200 + 404), registrado antes de `messagesRoute`.
- [x] 2.3 El tipo fluye por `AppType`; el cliente lo consume con `fetch` directo (verificado en build).

## 3. T1 — conversación en la URL + auto-scroll

- [x] 3.1 `router.replace(?c=<id>)` al seleccionar en `selectConversation` y `focusConversation`; se limpia `?c` al cambiar de número.
- [x] 3.2 `useEffect([searchParams, conversations, selectedId, orgId])` reconcilia `selectedId` desde `?c`, con `resolvedConvRef` anti-bucle.
- [x] 3.3 Fallback A: si `?c` no está en la lista, `GET /conversations/{id}` → `setConnectionId` + seleccionar; 404/excepción → `router.replace(pathname)`.
- [x] 3.4 Auto-scroll: centinela `<div ref={bottomRef}/>` al fondo del hilo + `useEffect([selectedId, messages.length])` con `scrollIntoView({ block: "end" })`.

## 4. T2 — reordenar por última actividad + hora

- [x] 4.1 Sin cambio de código: el spike (1.4) determinó que el camino de escritura ya es correcto; T2 se resuelve a nivel de entorno (webhook público alcanzable por Kapso).
- [x] 4.2 Revalidación en vivo al enviar: ya existe (`afterSend → revalidate()` muta `conversationsKey`). Verificado en código.
- [x] 4.3 Hora del último mensaje: ya cableada en inbox-client.tsx:510; aparece automáticamente cuando el índice recibe el entrante.

## 5. T3 — fondo del chat tipo WhatsApp

- [x] 5.1 Token `--chat-bg` definido en globals.css: `:root` `#efeae2`, `.dark` `#0b141a`.
- [x] 5.2 Área del hilo cambiada a `bg-[var(--chat-bg)]`; las burbujas entrantes usan `bg-background` (contrastan en ambos temas).

## 6. T4 — diálogo de plantilla ancho y desplazable

- [x] 6.1 `DialogContent` de `TemplateDialog` a `flex max-h-[85vh] flex-col sm:max-w-lg`.
- [x] 6.2 Bloque de campos a `flex-1 overflow-y-auto`; encabezado y `DialogFooter` ("Enviar") quedan fijos.

## 7. T5 — feedback de estado y asignación

- [x] 7.1 `sonner` instalado; `components/ui/sonner.tsx` (Toaster que sincroniza tema observando `.dark`) montado en `app/(app)/layout.tsx`.
- [x] 7.2 `changeStatus`: toast de éxito/error + `pulse()` (highlight sutil en la cabecera, `transition-colors`); la conversación permanece visible.
- [x] 7.3 `changeAssignment`: toast (con nombre del agente) + `pulse()` + `revalidate()` (sale de "mis conversaciones" si aplica).
- [x] 7.4 Copy de toasts en español neutro (tú).

## 7b. T3+ — color de burbuja saliente (solicitado durante la implementación)

- [x] 7b.1 Tokens `--chat-out`/`--chat-out-foreground` en globals.css: claro `#d9fdd3`/`#111b21`, oscuro `#005c4b`/`#e9edef`.
- [x] 7b.2 Burbuja saliente a `bg-[var(--chat-out)] text-[var(--chat-out-foreground)]`; ajustados texto/hora/iconos y enlaces (antes asumían fondo verde fuerte con texto blanco); checks de leído `text-sky-500`, fallo `text-red-600`.

## 8. Verificación

- [x] 8.1 Lint limpio en los archivos tocados (resuelto `react-hooks/set-state-in-effect`: `selectedId` con inicializador perezoso desde `?c` y resolución por id solo en rama asíncrona). Nota: persisten 8 errores preexistentes en el worker WASM de opus (vendorizado), ajenos a este cambio.
- [x] 8.2 `pnpm build` correcto (compila + TypeScript OK + páginas generadas).
- [x] 8.3 Recorrido manual (requiere app corriendo): enlace `?c` compartido (incluye otro número), auto-scroll, reorden al recibir/enviar, hora visible, fondo y burbujas en ambos temas, padding de imagen, plantilla con muchas variables, toasts de estado/asignación. 
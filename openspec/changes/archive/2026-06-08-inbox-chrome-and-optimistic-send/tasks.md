## 1. Contrato de envío con `wamid` (backend)

- [x] 1.1 En `web/lib/services/inbox/schemas.ts`, definir el schema de respuesta del envío de servicio que extienda/envuelva `ConversationDto` con un campo `wamid: z.string().nullable()`, y exportar su tipo.
- [x] 1.2 En `web/lib/services/inbox/service.ts`, hacer que `sendMessage` (envío de servicio) devuelva, junto a la conversación actualizada, el `wamid` (`result.messageId`), sin introducir I/O nuevo en la capa pura.
- [x] 1.3 En `web/lib/api/routes/v1/orgs/inbox.ts`, actualizar `sendMessageRoute` para responder con el nuevo schema (conversación + `wamid`).
- [x] 1.4 Verificar el tipo derivado en el cliente (`hono/client` / `AppType`) y, si el composer necesita el cuerpo de la respuesta, ajustar `web/components/app/inbox/send-helpers.ts` para devolverlo en el envío de servicio. (Verificado: el WAMID del envío == `id` del mensaje del hilo en Platform v1; el composer usará `sendMessageRequestJson`, que ya devuelve el cuerpo.)

## 2. Presentación de la lista de conversaciones

- [x] 2.1 En `InboxClient` (`web/components/app/inbox-client.tsx`), añadir un único "tick" de 60s (`useState` de `now` + `useEffect` con `setInterval` y cleanup) para refrescar el restante de ventana sin depender del polling.
- [x] 2.2 En el item de la lista, aplicar negrita condicional a nombre y texto de preview cuando `conv.unreadCount > 0` (conservando el badge numérico).
- [x] 2.3 Añadir `title={conv.lastMessageText ?? ""}` al `<span>` truncado del preview (tooltip nativo).
- [x] 2.4 Mostrar en la segunda línea, a la derecha, el restante de ventana usando `fmtRemaining` con el `now` del tick; cuando la ventana esté vencida (`!conv.windowOpen`), ocultar el restante y aplicar borde rojo al `Avatar`.

## 3. Encabezado del chat y carteles de ventana

- [x] 3.1 Extender el área clicable del encabezado para envolver también el avatar (además de nombre+número) de modo que todo alterne el panel derecho (`setInfoOpen`).
- [x] 3.2 Eliminar el bloque del cartel superior de estado de ventana (`web/components/app/inbox-client.tsx`, bloque ~714-729) y mover el restante de ventana al subtítulo del encabezado (bajo el número), en rojo "Ventana cerrada" cuando esté vencida.
- [x] 3.3 En `web/components/app/inbox/composer.tsx`, asegurar que el aviso "ventana cerrada / enviar plantilla" se muestre solo cuando `!conversation.windowOpen` y eliminar cualquier aviso inferior cuando la ventana esté abierta. (Ya cumplido: el aviso vive en el early-return con `!windowOpen`; con ventana abierta no hay aviso inferior.)

## 4. Header global del shell en `/inbox`

- [x] 4.1 En `web/components/app/app-shell.tsx`, no renderizar el `<header>` global superior cuando `fullBleed` (ruta `/inbox`), conservándolo en el resto de rutas.
- [x] 4.2 Reubicar el `SidebarTrigger` integrándolo en la barra de la lista de conversaciones de `InboxClient` (junto al selector de número), garantizando que quede accesible en `/inbox`.

## 5. Eco optimista de mensajes salientes

- [x] 5.1 Añadir el pseudo-estado `sending` en `DeliveryStatus` (`web/components/app/inbox-client.tsx`) renderizando `ClockIcon`, distinto de `pending`.
- [x] 5.2 En `InboxClient`, mantener estado de "optimistas pendientes" indexados por id temporal y reetiquetados con el `wamid` al volver la respuesta del envío.
- [x] 5.3 Componer el render del hilo como `messages` (SWR) + optimistas cuyo `wamid` aún no aparece en `messages`; descartar el optimista al detectar su `wamid` real (reconciliación por id, sin duplicados).
- [x] 5.4 Revertir el optimista e informar el error si el envío falla; aplicar la heurística de respaldo (mismo texto + saliente + ventana temporal) solo cuando `wamid` sea nulo.
- [x] 5.5 Cablear el eco en el flujo de envío del composer (texto/media) sin romper el `onSent`/reset actual.
- [x] 5.6 Mantener el foco en el input tras enviar con Enter (no deshabilitar el textarea en el envío de texto; reenfocar tras limpiar).
- [x] 5.7 Envío de texto sin bloqueo (fire-and-forget): el eco optimista da el feedback y el usuario puede seguir enviando sin esperar el primer check. Media/audio conservan bloqueo (un adjunto a la vez; cola concurrente = fuera de alcance).

## 6. Verificación

- [x] 6.1 Ejecutar `pnpm lint` en `web/` y resolver hallazgos (incluida la regla de `setState`/`ref` en render/efecto para tick y eco). (Verde tras mover la poda de optimistas fuera del efecto e ignorar `**/*.min.js` —worker WASM opus en `public/`— en `eslint.config.mjs`.)
- [x] 6.2 Ejecutar `pnpm build` en `web/` y confirmar que compila (tipos del nuevo contrato incluidos). (Compila; TypeScript OK.)
- [x] 6.3 Verificación manual del flujo: lista (negrita/tooltip/restante/borde rojo), encabezado (clic en avatar+nombre, sin cartel superior con ventana abierta, restante en subtítulo), `/inbox` sin header global con trigger accesible, y eco optimista con reloj reconciliándose al confirmar.

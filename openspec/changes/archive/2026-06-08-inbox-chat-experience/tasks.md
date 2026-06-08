## 1. Preparación

- [x] 1.1 Instalar componentes shadcn faltantes desde `web/`: `pnpm dlx shadcn@latest add scroll-area textarea`
- [x] 1.2 Crear carpeta `web/components/app/inbox/` y extraer el `Composer` actual (sin cambios de comportamiento) a `composer.tsx`, importándolo desde `inbox-client.tsx`
- [x] 1.3 Mover los helpers de envío compartidos (`sendMessageRequest`, `sendMessageRequestJson`) a un módulo reutilizable dentro de `components/app/inbox/`

## 2. Sección A — Composer con borrador y multilínea

- [x] 2.1 Definir el tipo `PendingAttachment` y el estado `attachments` (arreglo, máx. 1 en v1) en el `Composer`
- [x] 2.2 Sustituir el envío inmediato de `sendFile` por adjuntar al borrador desde el selector de archivos (📎)
- [x] 2.3 Renderizar el borrador del adjunto (miniatura para imagen/video, tarjeta para documento) con botón para quitarlo
- [x] 2.4 Unificar el envío en un `send()` que sube el adjunto por URL firmada y postea media + `text` como caption, o postea solo texto si no hay adjunto
- [x] 2.5 Reemplazar el `<Input>` por `<Textarea>` auto-crecible; `Enter` envía, `Shift+Enter`/`Ctrl+Enter` insertan salto
- [x] 2.6 Aplicar el límite de 1 adjunto con aviso ("Solo se adjunta un archivo a la vez") al intentar más de uno

## 3. Sección A — Pegar y arrastrar

- [x] 3.1 Añadir `onPaste` en el textarea: detectar imágenes del portapapeles, `preventDefault` y adjuntarlas al borrador
- [x] 3.2 Añadir `onDragOver/onDragLeave/onDrop` en la `<section>` del hilo con overlay "Suelta para adjuntar" visible solo durante el arrastre
- [x] 3.3 Inhabilitar pegar y arrastrar cuando la ventana de 24h está cerrada, con aviso de que solo puede enviarse plantilla

## 4. Sección A — Audio

- [x] 4.1 Crear `audio-recorder.tsx` con grabación a `audio/ogg;codecs=opus` vía `opus-recorder` (worker WASM copiado a `public/opus/` por `postinstall`). NOTA: se descartó `MediaRecorder` nativo porque Chrome solo produce `audio/webm`, que WhatsApp rechaza (riesgo R1).
- [x] 4.2 Mostrar el botón de micrófono solo cuando `text` está vacío y no hay adjunto; conmutar a botón de enviar en caso contrario
- [x] 4.3 Previsualizar el audio grabado (`<audio controls>`) con opciones enviar/descartar, sin envío automático
- [x] 4.4 Enviar el blob de audio reutilizando `send()` (subida + POST de tipo audio, sin caption)
- [x] 4.5 Verificar end-to-end contra Kapso que el audio se entrega como nota de voz (riesgo R1); degradar con aviso si el navegador no produce un formato aceptado

## 5. Sección B — Búsqueda de contactos (backend + UI)

- [x] 5.1 Añadir `search` (opcional) a `ListContactsQuery` en `web/lib/services/contacts/schemas.ts`
- [x] 5.2 En `listContacts` (`service.ts`), aplicar condición `ilike` sobre nombre, apellido y teléfono E.164 cuando hay `search`, combinable con `tagId`, acotada a la organización
- [x] 5.3 Añadir el input de búsqueda a la vista de listado de contactos, enlazado al parámetro `search` con debounce
- [x] 5.4 Validar aislamiento por organización y combinación búsqueda + etiqueta

## 6. Sección B — Iniciar conversación desde el inbox con selector de contacto

- [x] 6.1 Reemplazar el input de teléfono crudo de `StartConversationDialog` por un selector con búsqueda de contactos (reutiliza el endpoint de 5.1-5.2)
- [x] 6.2 Al elegir contacto, crear/recuperar la conversación y, si no hay ventana abierta, abrir el diálogo de plantilla
- [x] 6.3 Conservar la entrada manual por teléfono como alternativa para números no guardados

## 7. Sección C — Panel de información plegable

- [x] 7.1 Añadir estado `infoOpen` (oculto por defecto) y renderizar el panel derecho solo cuando está abierto
- [x] 7.2 Conmutar el panel con clic en el nombre del contacto en la cabecera del hilo
- [x] 7.3 Añadir un icono de información junto al selector de estado que conmuta el panel

## 8. Sección C — Scroll moderno

- [x] 8.1 Envolver la lista de conversaciones (`inbox-client.tsx:420`) en `<ScrollArea>`
- [x] 8.2 Envolver el hilo de mensajes (`inbox-client.tsx:548`) en `<ScrollArea>` (no había auto-scroll programático previo que reapuntar)
- [x] 8.3 Envolver el panel de información en `<ScrollArea>`
- [x] 8.4 Verificar que el polling (SWR 4s) y el desplazamiento por teclado/rueda siguen funcionando

## 9. Verificación

- [x] 9.1 `pnpm lint` y `pnpm build` sin errores
- [ ] 9.2 Verificación manual del composer: enviar texto, imagen, video, documento y audio con y sin caption, dentro y fuera de la ventana de 24h
- [x] 9.3 Verificación manual de búsqueda de contactos, xinicio de conversación desde contacto, panel plegable y scroll moderno

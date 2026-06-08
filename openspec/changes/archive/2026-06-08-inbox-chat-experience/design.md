## Context

Todo el inbox vive en un único componente cliente, [web/components/app/inbox-client.tsx](web/components/app/inbox-client.tsx) (~1860 líneas), que ya resuelve listado, hilo, plantillas, interactivos, asignación, estados y ventana de 24h. El `Composer` interno funciona en modo "enviar al instante": `sendText()` y `sendFile()` (que sube por URL firmada y postea el mensaje de inmediato). El panel derecho de información está siempre montado (`lg:flex`). Las áreas con scroll usan `overflow-y-auto` nativo. El backend de envío de inbox ya soporta texto/imagen/video/documento/audio con caption donde aplica ([web/lib/services/inbox/service.ts](web/lib/services/inbox/service.ts) líneas 470-478). El backend de contactos lista por offset y etiqueta, pero `ListContactsQuery` no tiene `search`.

El stack es Next 16 + React 19 + Tailwind v4 + shadcn/ui (iconos `@phosphor-icons/react`). La separación dominio/transporte es obligatoria: la lógica de contactos vive en `lib/services/contacts/` y las rutas Hono son carcasa.

## Goals / Non-Goals

**Goals:**
- Convertir el `Composer` a un modelo de **borrador** con un adjunto en staging y el texto como caption, sin romper el envío de solo texto, plantillas ni interactivos.
- Añadir grabación de audio con previsualización, entrada multilínea, pegar y arrastrar, todo bajo el gate de la ventana de 24h.
- Buscar contactos por nombre y teléfono (backend + UI) y reutilizar esa búsqueda en un selector de contacto para iniciar conversación desde el inbox.
- Panel de información oculto por defecto y conmutable.
- Reemplazar el scroll nativo por una barra **tipo overlay** (delgada, auto-superpuesta) en las áreas del inbox.
- Mantener cada porción reseñable dentro del presupuesto de ~400 líneas (PRs encadenados por sección).

**Non-Goals:**
- Soporte de **varios adjuntos / álbum con caption por ítem** (el modelo de datos queda preparado, la UI no).
- Cambios en el contrato de webhooks de Kapso ni en el esquema de base de datos.
- Transcripción de audio entrante (ya existe `transcript` en el render; no se toca).
- Unificación de hilos por número y otras ideas de `openspec/ideas.md` (fuera de alcance).

## Decisions

### D1 — El `Composer` pasa a un modelo de borrador (`draft`)

Estado nuevo en el `Composer`:

```
type PendingAttachment = {
  file: File;
  kind: "image" | "video" | "document" | "audio";
  previewUrl: string; // URL.createObjectURL para imagen/video/audio
};
// v1: un único adjunto, pero modelado como arreglo para no rehacer después.
const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
```

El envío se unifica en un `send()` que: si hay adjunto, sube por URL firmada (lógica actual de `sendFile`) y postea con `text` como caption; si no, postea texto. Las cuatro fuentes (selector, pegar, arrastrar, grabación) terminan en `setAttachments`. **Alternativa descartada:** mantener `sendFile` inmediato y solo añadir un diálogo de confirmación con caption — más simple pero no habilita pegar/arrastrar de forma natural ni el caption inline que pide la feature 5.

### D2 — Botón derecho como conmutador mic/enviar

El botón a la derecha del input se decide con `text.trim() || attachments.length` → enviar; en caso contrario → micrófono. Esto hace **imposible** tener texto y grabación a la vez, lo que elimina el conflicto de caption en audio (WhatsApp no admite caption de audio). Coincide con el comportamiento descrito en la feature 3.

### D3 — Grabación con `MediaRecorder` + previsualización

Se usa la API `MediaRecorder` del navegador. Flujo: pedir permiso → grabar → `stop()` produce un `Blob` → se crea un `PendingAttachment` de tipo audio con `previewUrl` para un `<audio controls>` → el agente envía o descarta. La grabación reutiliza el mismo `send()` (sube el blob como archivo de audio). **Decisión de formato:** grabar preferentemente en `audio/ogg;codecs=opus` cuando `MediaRecorder.isTypeSupported` lo permita (compatible con WhatsApp voice), con degradación a `audio/webm;codecs=opus`. Ver riesgo R1.

### D4 — Entrada multilínea con `Textarea` (shadcn) auto-crecible

Se reemplaza el `<Input>` del composer por `<Textarea>` (componente shadcn a instalar). `onKeyDown`: `Enter` sin modificador → `send()` y `preventDefault`; `Shift+Enter`/`Ctrl+Enter` → comportamiento por defecto (salto). Auto-grow por `scrollHeight` con `max-height` y `overflow-y` interno (con el scroll moderno de D7).

### D5 — Pegar y arrastrar, gateados por ventana

- **Pegar:** handler `onPaste` en el textarea que inspecciona `clipboardData.items`; si hay imagen, `preventDefault` y se adjunta; el texto normal se pega como siempre.
- **Arrastrar:** `onDragOver/onDragLeave/onDrop` sobre la `<section>` del hilo, con un overlay absoluto "Suelta para adjuntar" visible solo durante el arrastre. Ambos respetan el límite de 1 adjunto (toma el primero, avisa con un texto de error breve) y se **inhabilitan con la ventana cerrada** (el composer ya hace swap a "solo plantilla").

### D6 — Búsqueda de contactos: backend primero

En `lib/services/contacts/`:
- `schemas.ts`: añadir `search: z.string().trim().min(1).optional()` a `ListContactsQuery`.
- `service.ts`: en `listContacts`, si `search` está presente, añadir una condición `OR(ilike(firstName, %q%), ilike(lastName, %q%), ilike(phone, %q%))` al `where`, combinable con `tagId`. La normalización de teléfono reutiliza `lib/services/contacts/phone.ts` para comparar contra E.164.
La ruta Hono no cambia su forma (sigue validando `query`), solo hereda el nuevo campo del schema. **Alternativa descartada:** filtrar en cliente sobre la página actual — rompe la paginación y no escala.

### D7 — Scroll moderno con shadcn `ScrollArea` (Radix)

Las tres áreas (`overflow-y-auto` en líneas 420, 548, y el panel de info) se envuelven en `<ScrollArea>` (Radix UI, vía `pnpm dlx shadcn@latest add scroll-area`), que renderiza una barra delgada superpuesta y auto-ocultable. **Alternativa considerada:** CSS puro `scrollbar-width: thin` + `scrollbar-color` — menos dependencias pero apariencia inconsistente entre navegadores (Safari no soporta `scrollbar-width`) y sin auto-ocultado real. Se elige `ScrollArea` por consistencia con el resto del sistema shadcn. Cuidado: el auto-scroll del hilo (polling SWR cada 4s) debe seguir funcionando con el viewport de `ScrollArea`.

### D8 — Extraer el Composer y piezas a archivos propios

Para respetar el presupuesto de ~400 líneas por PR y dejar el código mantenible, se extrae el `Composer` (y sus subpiezas nuevas: grabador de audio, borrador de adjunto, overlay de drop) a `components/app/inbox/` en archivos propios, en lugar de seguir inflando `inbox-client.tsx`. El selector de contacto del inicio de conversación también se aísla. Esto habilita los PRs encadenados por sección.

## Risks / Trade-offs

- **R1 — Formato de audio incompatible con WhatsApp. [RESUELTO]** `MediaRecorder` en Chrome produce `audio/webm`, que WhatsApp **rechaza** como nota de voz (acepta AAC, MP4, AMR, MP3 y OGG/OPUS) — el fallo se confirmó en producción ("Fallido" en la entrega). → **Resolución:** se reemplazó `MediaRecorder` por `opus-recorder` (WASM), que graba directo a `audio/ogg;codecs=opus` en todos los navegadores. El worker `encoderWorker.min.js` (wasm inlined) se vendoriza en `public/opus/` vía `postinstall` y se importa de forma dinámica para no romper el SSR de los Client Components. El motivo de fallo de entrega queda en logs del servidor (`[inbox-webhook] mensaje saliente fallido` con `reason`), no en R2.
- **R2 — Pegar binarios en el textarea.** Si el `onPaste` no hace `preventDefault` ante imágenes, el binario puede ensuciar el texto. → **Mitigación:** detectar `items` de tipo imagen y cortar el evento antes del default.
- **R3 — Envíos accidentales con Enter en multilínea.** Cambiar a textarea con `Enter`=enviar puede sorprender. → **Mitigación:** mantener exactamente la semántica actual (Enter envía, Shift/Ctrl+Enter salta) y placeholder que lo insinúe.
- **R4 — `ScrollArea` y el auto-scroll del hilo.** El viewport interno de Radix cambia el nodo desplazable. → **Mitigación:** apuntar el scroll programático al viewport de `ScrollArea`, no al contenedor externo.
- **R5 — Regresión del envío inmediato.** Pasar de `sendFile` inmediato a staging es **BREAKING** del flujo interno. → **Mitigación:** cubrir con verificación manual de los cinco tipos (texto, imagen, video, documento, audio) dentro y fuera de la ventana.

## Migration Plan

1. Instalar dependencias UI: `pnpm dlx shadcn@latest add scroll-area textarea` (desde `web/`).
2. Sección B backend: `search` en `ListContactsQuery` + `listContacts` (sin migración de BD).
3. Refactor del `Composer` a borrador (D1, D2, D4) extrayéndolo a `components/app/inbox/`.
4. Pegar/arrastrar (D5) sobre el composer ya refactorizado.
5. Audio (D3) — última pieza de la sección A por el riesgo R1.
6. Selector de contacto en el inicio de conversación (D6 UI) + búsqueda en la lista de contactos.
7. Panel plegable + scroll moderno (D7) en las áreas del inbox.

**Rollback:** la mayoría es UI aditiva sobre un solo componente; revertir los archivos extraídos restaura el comportamiento previo. El `search` de contactos es opcional y retrocompatible (sin `search` la lista se comporta igual que hoy).

## Open Questions

- ¿Qué formato exacto de audio acepta el número vía Kapso en producción? (R1 — verificar antes de cerrar la sección de audio.)
- ¿El icono del panel de información va junto al selector de estado en la cabecera, o también un control de cierre dentro del propio panel? (Decisión menor de UX, se resuelve al implementar la sección C.)

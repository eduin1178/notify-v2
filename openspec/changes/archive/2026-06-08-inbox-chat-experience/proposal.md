## Why

El composer del inbox funciona hoy en modo "enviar al instante": adjuntar un archivo lo manda de inmediato, sin caption, sin previsualización, y el input es de una sola línea. Eso obliga al agente a flujos torpes (mandar el archivo y luego el texto por separado) y se aleja de la experiencia que los agentes ya conocen de WhatsApp. Además, el panel de información ocupa espacio permanentemente y las áreas de scroll usan la barra nativa del navegador, que rompe la sensación de producto moderno. Estas fricciones se notan en cada conversación.

## What Changes

Agrupado en tres secciones; todo dentro de la ventana de servicio de 24h donde aplique.

**Sección A — Composer (borrador con adjuntos):**
- Introducir un modelo de **borrador** en el composer: los archivos se **adjuntan al chat** (staging) en vez de enviarse al instante, y el texto del input actúa como **caption**. El envío manda media + caption juntos. **BREAKING** del flujo actual `sendFile` inmediato.
- **Audio**: botón de micrófono que aparece **solo con el input vacío** (excluyente con el texto); grabar → parar → previsualizar (waveform) → enviar o descartar. El audio no lleva caption.
- **Input multilínea**: `Enter` envía, `Shift+Enter` / `Ctrl+Enter` insertan salto de línea.
- **Pegar imagen** desde el portapapeles directamente al staging.
- **Arrastrar y soltar** archivos sobre el panel de conversación (overlay), que los adjunta al staging.
- v1 soporta **un adjunto a la vez** con caption; el modelo de datos queda preparado para varios.

**Sección B — Contactos y nueva conversación:**
- **Búsqueda de contactos** por nombre y por número de teléfono (E.164) en el listado de contactos.
- **Iniciar conversación desde el inbox** eligiendo un contacto de un selector con búsqueda (en lugar de teclear el teléfono crudo) y enviando una plantilla.

**Sección C — Panel e interacción:**
- El **panel de información** del contacto/conversación queda **oculto por defecto** y se abre con clic en el nombre del contacto (cabecera del hilo) o con un icono junto al selector de estado.
- **Scroll moderno** (barra tipo overlay, delgada y auto-ocultable) en las áreas de scroll del inbox, reemplazando la barra nativa del navegador.

## Capabilities

### New Capabilities
<!-- Sin capacidades nuevas: todo modifica comportamiento de specs existentes. -->

### Modified Capabilities
- `inbox`: nuevos requisitos de composer (borrador/staging con caption, audio con previsualización, multilínea, pegar, arrastrar y soltar), panel de información plegable y scroll moderno en las áreas del inbox.
- `contacts`: nuevo requisito de búsqueda de contactos por nombre y teléfono (E.164) en el listado.

## Impact

- **Frontend (la mayor parte):** [web/components/app/inbox-client.tsx](web/components/app/inbox-client.tsx) — composer, panel derecho, áreas de scroll, diálogo de inicio de conversación. La lista de contactos en [web/app/(app)/org/[orgSlug]/](web/app/(app)/org/[orgSlug]/) para la búsqueda.
- **Backend (acotado a contactos):** `ListContactsQuery` y `listContacts` en [web/lib/services/contacts/](web/lib/services/contacts/) para añadir el filtro `search` (nombre + teléfono). El envío de inbox (texto/imagen/video/documento/audio con caption) ya está soportado en [web/lib/services/inbox/service.ts](web/lib/services/inbox/service.ts) y no cambia.
- **Dependencias UI nuevas:** componentes shadcn `scroll-area` (Radix ScrollArea) y `textarea`, hoy no instalados. API del navegador `MediaRecorder` para el audio.
- **Sin cambios de esquema de base de datos.** Sin cambios en el contrato de webhooks de Kapso.

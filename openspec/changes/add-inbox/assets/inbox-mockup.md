# Mockup de referencia — Inbox

> **Archivo de imagen:** [`inbox-mockup.png`](./inbox-mockup.png)
>
> Este mockup es **parte del requerimiento** y fija el layout objetivo del Inbox.
> La imagen fue aportada por el usuario al iniciar el cambio. Guárdala en esta
> carpeta con el nombre `inbox-mockup.png` para que quede versionada junto al
> resto de los artefactos.

## Layout objetivo (tres columnas)

```
┌──────────────────────┬───────────────────────────────────┬──────────────────────┐
│ COLUMNA IZQUIERDA     │ PANEL CENTRAL (hilo)              │ COLUMNA DERECHA       │
│ (lista)               │                                   │ (contexto)            │
│                       │                                   │                       │
│ ▸ Selector de número  │ Cabecera: nombre + teléfono del   │ Datos del contacto    │
│   (filtro principal)  │ contacto, "Asignado a", estado    │ (nombre, teléfono,    │
│                       │ (Abierta/Pendiente/Cerrada)       │ país, idioma, última  │
│ ▸ Tabs: Todas / Sin   │                                   │ interacción, notas)   │
│   leer / Menciones    │ Banner "Ventana de servicio       │ + etiquetas (Cliente, │
│                       │ abierta — 08h 24m restantes,      │ VIP)                  │
│ ▸ Filtro de estado:   │ cierra a las 20:15"               │                       │
│   Abierta / Pendiente │                                   │ Datos de la           │
│   / Cerrada           │ Mensajes (texto, PDF, audio,      │ conversación (estado, │
│                       │ video, etc.) con marcas de        │ asignado a, fuente,   │
│ ▸ Filtro asignación:  │ entrega (✓✓)                      │ creada el, último     │
│   Mis conversaciones /│                                   │ entrante, ventana 24h)│
│   Sin asignar / Otros │ Composer con pestañas:            │                       │
│                       │ Texto · Plantilla · Imagen ·      │ Acciones rápidas:     │
│ ▸ Buscar              │ Documento · Audio · Video         │ ver contacto, crear   │
│                       │                                   │ ticket, agregar nota, │
│ ▸ Nueva conversación  │ Aviso: "Puedes enviar mensajes    │ transferir            │
│   - Mensaje de        │ de servicio. Ventana abierta por  │                       │
│     servicio (<24h)   │ 08h 24m."                         │                       │
│   - Mensaje de        │                                   │                       │
│     plantilla (>24h o │                                   │                       │
│     proactivo)        │                                   │                       │
│                       │                                   │                       │
│ ▸ Lista de chats con  │                                   │                       │
│   avatar, nombre,     │                                   │                       │
│   último mensaje,     │                                   │                       │
│   hora y badge de no  │                                   │                       │
│   leídos (verde)      │                                   │                       │
└──────────────────────┴───────────────────────────────────┴──────────────────────┘
```

## Elementos que el mockup confirma como requisito

- **Selector de número** como filtro principal (req #6).
- **Estados** Abierta / Pendiente / Cerrada como filtro (req #1).
- **Filtro de asignación** Mis conversaciones / Sin asignar / Otros (req #4).
- **Badge de no leídos** por conversación (verde, con conteo).
- **Banner de ventana de 24h** con tiempo restante y hora de cierre (req #2).
- **Composer multi-tipo**: Texto, Plantilla, Imagen, Documento, Audio, Video (req #7, #3).
- **Nueva conversación**: mensaje de servicio (dentro de 24h) o plantilla (fuera de 24h / proactivo) (req #5).
- **Marcas de entrega** (✓✓) en los mensajes salientes.
- **Panel de contexto** con datos del contacto y de la conversación, y acciones rápidas.

> Nota: la columna derecha (panel de contexto, "crear ticket", "transferir") y los
> tabs "Menciones" se documentan como referencia visual. El alcance funcional de v1
> está acotado por la spec; los elementos no cubiertos por un requisito SHALL se
> consideran inspiración de UI, no compromiso de v1.

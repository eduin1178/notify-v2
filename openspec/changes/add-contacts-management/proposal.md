## Why

Notify ya puede vincular números de WhatsApp a una organización ([[whatsapp-connection]]), pero todavía no tiene **a quién** notificar. La gestión de contactos es la pieza que convierte la conexión en un canal útil: sin una base de destinatarios administrable no hay envíos, segmentación ni campañas. Es la segunda capa fundacional del producto, justo después de la conexión.

El feature pedido ([openspec/features.md](../../features.md)) cubre el ciclo completo de contactos: alta/edición/baja manual, importación (CSV y desde WhatsApp vía Kapso), exportación CSV, etiquetado y filtrado, conteo en el dashboard y un listado paginado con un **paginador reutilizable** destinado a otros módulos futuros.

## What Changes

- **Nueva capability `contacts`**: gestión de contactos a nivel de organización (multi-tenant), con atributos `nombres`, `apellidos`, `teléfono`, `email`, `dirección`, `ciudad`, `empresa`. Solo `nombres` y `teléfono` son obligatorios; el **teléfono es la identidad** (único por organización, normalizado a E.164).
- **CRUD manual** vía formulario, con validación estricta en el formulario (incluido apellido obligatorio en alta manual).
- **Listado paginado por offset** y **componente paginador reutilizable** (primera/anterior/siguiente/última página, número de página actual, selector de tamaño de página, botones habilitados/deshabilitados según corresponda).
- **Etiquetas** (relación N:M): crear etiquetas por organización, asignar una o varias a un contacto y **filtrar contactos por etiqueta**.
- **Importación CSV** con normalización de teléfono, deduplicación por `(organización, teléfono)` y reporte de resultado (importados / omitidos / con error). **Exportación CSV** del listado.
- **Importación desde WhatsApp** a través de Kapso, **siempre filtrada por el `phone_number_id` de una conexión concreta** de la organización (no a nivel de customer). Mapea `wa_id → teléfono`, `profile_name → nombres`; **omite** los contactos sin `wa_id` (identidad solo BSUID de Meta) y reporta cuántos se omitieron.
- **Card de conteo de contactos** en el dashboard de la organización (análoga a la card "Miembros").

**Entrega en 4 fases** (cada una es un slice revisable por PR, dentro del presupuesto cognitivo de ~400 líneas):
1. CRUD manual + listado paginado + paginador reutilizable + card del dashboard.
2. Etiquetas + asignación + filtrado por etiqueta.
3. Importación y exportación CSV.
4. Importación desde WhatsApp (Kapso), filtrada por `phone_number_id`.

## Capabilities

### New Capabilities
- `contacts`: gestión de contactos por organización — CRUD manual, listado paginado (offset) con paginador reutilizable, etiquetado N:M y filtro por etiqueta, import/export CSV, importación desde WhatsApp (Kapso) filtrada por `phone_number_id`, y conteo en el dashboard. Teléfono como clave única por organización (E.164).

### Modified Capabilities
<!-- Ninguna. El conteo en el dashboard, la lectura de una conexión `connected` para la importación desde WhatsApp y el reuso del adaptador Kapso son detalles de implementación introducidos POR esta capability; no cambian los requisitos de `whatsapp-connection`, `organizations`, `billing` ni `rest-api`. Los contactos NO son un entitlement facturado en este alcance. -->

## Impact

- **Base de datos**: nuevas tablas `contact`, `tag`, `contact_tag` (join N:M); restricción `UNIQUE(organization_id, phone)`; migración Drizzle (`web/lib/db/schema.ts` → `web/drizzle/migrations/`). Aditiva.
- **Capa de servicios**: nuevo dominio `web/lib/services/contacts/` (`service.ts`, `schemas.ts`) con `TenantServiceContext` y `DomainErrors`, módulo puro (sin `next/*` ni `hono`).
- **REST API**: nuevas rutas tenant-scoped bajo `/api/v1/orgs/:orgId/contacts/...` (Hono + `@hono/zod-openapi`), reutilizando los schemas del servicio.
- **UI**: nueva sección `app/(app)/org/[orgSlug]/contacts/` (listado, formulario alta/edición, etiquetas, importación) y nuevo componente reutilizable `components/ui/pagination.tsx`. Card de conteo en `app/(app)/org/[orgSlug]/page.tsx`.
- **Integración externa**: reutiliza el adaptador Kapso existente (`web/lib/integrations/kapso/`), extendido con `listContacts(phoneNumberId, cursor)` sobre `GET /meta/whatsapp/{phone_number_id}/contacts` (paginación por cursor). Reutiliza `KAPSO_API_KEY` — sin nuevas variables de entorno.
- **Dependencia nueva**: `libphonenumber-js` para validar/normalizar teléfonos a E.164.
- **Billing**: sin cambios. Los contactos NO se gatean por plan; el dashboard solo muestra el conteo.
- **Fuera de alcance**: envío de mensajes/notificaciones a contactos, segmentación avanzada, campos personalizados (custom fields), deduplicación con merge interactivo, sincronización automática continua desde WhatsApp (la importación es bajo demanda), e importación desde otras fuentes (Google Contacts, vCard).

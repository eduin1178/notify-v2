# Tasks

Entrega por fases. Cada fase es un slice revisable por PR (work-unit commits) dentro del presupuesto de ~400 líneas. Cada fase deja la app funcional.

## Fase 1 — CRUD manual + listado paginado + paginador reutilizable + dashboard

### 1.1 Datos
- [x] 1.1.1 Añadir tabla `contact` a `web/lib/db/schema.ts`: `id` (pk), `organization_id` (FK cascade), `first_name` (notNull), `last_name` (nullable), `phone` (notNull, E.164), `email`, `address`, `city`, `company` (nullable), `source` (`manual|csv|whatsapp`, default `manual`), `created_at`, `updated_at`; restricción `unique(organization_id, phone)`
- [x] 1.1.2 Registrar `contact` en el objeto `schema` exportado
- [x] 1.1.3 Añadir `libphonenumber-js` a `web/package.json` (`pnpm add libphonenumber-js`)
- [x] 1.1.4 Generar la migración Drizzle (`pnpm db:generate`) y verificar el SQL en `web/drizzle/migrations/` (`0005_fixed_big_bertha.sql`)

### 1.2 Servicio `contacts`
- [x] 1.2.1 Crear `web/lib/services/contacts/schemas.ts`: `ContactDto`, `CreateContactInput` (nombres/apellidos/teléfono obligatorios), `UpdateContactInput`, `ListContactsQuery` (`page`, `pageSize`), `PaginatedContactsResponse` (`items`, `page`, `pageSize`, `total`, `totalPages`)
- [x] 1.2.2 Crear helper de normalización de teléfono a E.164 con `libphonenumber-js` (`web/lib/services/contacts/phone.ts`) — `normalizePhone`/`isValidPhone`; el servicio lanza `DomainErrors.validation`
- [x] 1.2.3 `createContact(ctx, input)`: normaliza teléfono, valida unicidad por org (`conflict` si duplicado), inserta con `source="manual"`
- [x] 1.2.4 `listContacts(ctx, query)`: query org-scoped con `LIMIT/OFFSET` + `COUNT(*)`; devuelve el contrato paginado
- [x] 1.2.5 `getContact(ctx, id)`, `updateContact(ctx, id, input)` (re-normaliza y re-valida unicidad), `deleteContact(ctx, id)` — todos org-scoped, `notFound` si no pertenece
- [x] 1.2.6 `countContacts(ctx)` para la card del dashboard
- [x] 1.2.7 Usar `DomainErrors` (forbidden/notFound/conflict/validation) en todos los caminos de error

### 1.3 REST API
- [x] 1.3.1 Crear `web/lib/api/routes/v1/orgs/contacts.ts` con router `OpenAPIHono`, middleware `[requireSession, requireOrgMembership]`, `buildTenantServiceContext`, reutilizando los schemas del servicio
- [x] 1.3.2 `POST /orgs/{orgId}/contacts` (crear), `GET /orgs/{orgId}/contacts` (listar paginado con `page`/`pageSize`)
- [x] 1.3.3 `GET /orgs/{orgId}/contacts/{id}`, `PATCH .../{id}`, `DELETE .../{id}`
- [x] 1.3.4 Montar el router de contactos en `web/lib/api/routes/v1/index.ts`

### 1.4 UI
- [x] 1.4.1 Crear componente reutilizable `web/components/ui/pagination.tsx`: props `{ page, pageSize, total, pageSizeOptions, onPageChange, onPageSizeChange }`; botones primera/anterior/[página X de Y]/siguiente/última + selector de `pageSize`; habilita/deshabilita según posición. Agnóstico de dominio.
- [x] 1.4.2 Crear `app/(app)/org/[orgSlug]/contacts/page.tsx`: Server Component que lee `page`/`pageSize` de searchParams y llama al servicio; pasa datos a `contacts-client.tsx`
- [x] 1.4.3 Formulario de alta/edición (validación estricta: nombres, apellidos y teléfono obligatorios) vía Server Actions, y eliminación con confirmación (`alert-dialog`)
- [x] 1.4.4 Añadir card de conteo de contactos en `app/(app)/org/[orgSlug]/page.tsx` (análoga a la card "Miembros") con enlace a la sección + ítem de navegación en el layout
- [x] 1.4.5 Copy en español neutral (tú, sin voseo) en labels, placeholders, validaciones, estados vacíos y mensajes

### 1.5 Verificación Fase 1
- [x] 1.5.1 `pnpm lint` y `pnpm build` sin errores
- [x] 1.5.2 Verificar end-to-end (requiere DB + servidor): crear, editar, eliminar; unicidad de teléfono por org; paginación (primera/última/selector); card del dashboard; aislamiento entre organizaciones — verificado en runtime por el usuario

## Fase 2 — Etiquetas + asignación + filtrado

### 2.1 Datos
- [x] 2.1.1 Añadir tabla `tag` a `schema.ts`: `id`, `organization_id` (FK cascade), `name` (notNull), `created_at`, `updated_at`; `unique(organization_id, name)`
- [x] 2.1.2 Añadir tabla `contact_tag` (join): `contact_id` (FK cascade), `tag_id` (FK cascade), PK compuesta `(contact_id, tag_id)`
- [x] 2.1.3 Registrar ambas en el objeto `schema`; generar y verificar migración Drizzle (`0006_low_cardiac.sql`)

### 2.2 Servicio
- [x] 2.2.1 Schemas: `TagDto`, `CreateTagInput`, `AssignTagsInput`; extender `ContactDto` con `tags`
- [x] 2.2.2 `listTags(ctx)`, `createTag(ctx, name)` (`conflict` si nombre duplicado), `deleteTag(ctx, id)`
- [x] 2.2.3 `setContactTags(ctx, contactId, tagIds)` — org-scoped, valida que contacto y etiquetas pertenecen a la org (reemplaza el conjunto)
- [x] 2.2.4 Extender `listContacts` para incluir las etiquetas de cada contacto y aceptar filtro opcional `tagId` (devuelve solo contactos con esa etiqueta; metadatos sobre el subconjunto)

### 2.3 REST API
- [x] 2.3.1 `GET/POST /orgs/{orgId}/tags`, `DELETE /orgs/{orgId}/tags/{tagId}`
- [x] 2.3.2 `PUT /orgs/{orgId}/contacts/{id}/tags` (asignar/reemplazar etiquetas del contacto)
- [x] 2.3.3 Añadir parámetro `tagId` al `GET /orgs/{orgId}/contacts`

### 2.4 UI
- [x] 2.4.1 Gestión de etiquetas (crear/eliminar, diálogo "Gestionar etiquetas") y asignación de etiquetas a un contacto (checklist multi-selección en el formulario)
- [x] 2.4.2 Control de filtro por etiqueta sobre el listado, integrado con el paginador (resetea a página 1)
- [x] 2.4.3 Mostrar las etiquetas como chips en el listado; copy en español neutral

### 2.5 Verificación Fase 2
- [x] 2.5.1 `pnpm lint` y `pnpm build`
- [x] 2.5.2 Verificar (requiere DB): crear etiqueta (y rechazo de duplicado), asignar/quitar varias, filtrar por etiqueta con paginación correcta — verificado en runtime por el usuario

## Fase 3 — Import/Export CSV

### 3.1 Servicio
- [x] 3.1.1 `exportContactsCsv(ctx)`: genera CSV con cabeceras de todos los atributos; neutraliza fórmulas (prefijo en campos que empiezan por `= + - @`) — en `lib/services/contacts/csv.ts`
- [x] 3.1.2 `importContactsCsv(ctx, csvText)`: parseo por cabeceras (`nombres,apellidos,telefono,email,direccion,ciudad,empresa`); por fila normaliza teléfono y valida; dedup por `(org, phone)` con **skip** (también dentro del lote); filas inválidas a `invalid` sin detener el lote; `source="csv"`
- [x] 3.1.3 Devolver reporte `{ imported, skippedDuplicate, invalid: [{ row, reason }] }`
- [x] 3.1.4 Schemas del reporte (`ImportCsvReport`, `ImportInvalidRow`)

### 3.2 REST API
- [x] 3.2.1 `GET /orgs/{orgId}/contacts/export` → responde `text/csv` con `Content-Disposition` (router plano `contacts-csv.ts`, montado antes del router OpenAPI)
- [x] 3.2.2 `POST /orgs/{orgId}/contacts/import` (body `text/csv`) → devuelve el reporte

### 3.3 UI
- [x] 3.3.1 Botón de exportar (descarga el CSV vía Blob)
- [x] 3.3.2 Flujo de importar: subir archivo, mostrar reporte (importados / omitidos por duplicado / inválidos con motivo); copy en español neutral

### 3.4 Verificación Fase 3
- [x] 3.4.1 `pnpm lint` y `pnpm build`
- [x] 3.4.2 Verificar (requiere DB): exportar y reimportar el mismo archivo es idempotente (todo duplicado); filas inválidas reportadas; CSV injection neutralizada — verificado en runtime por el usuario

## Fase 4 — Importación desde WhatsApp (Kapso), acotada a phone_number_id

### 4.1 Adaptador Kapso
- [x] 4.1.1 Extender `web/lib/integrations/kapso/client.ts` con `listWhatsappContacts(phoneNumberId, { after?, limit? })` → `GET /meta/whatsapp/{phone_number_id}/contacts` (header `X-API-Key`), con tipos de respuesta (`wa_id` nullable, `profile_name`, `display_name`, `business_scoped_user_id`, `paging.cursors`). Refactor: `requestUrl` reutilizable para base Platform y base Meta
- [x] 4.1.2 `listWhatsappContacts` devuelve `nextCursor` (null al agotarse); el servicio recorre todas las páginas por cursor con tope de seguridad

### 4.2 Servicio
- [x] 4.2.1 `importContactsFromWhatsApp(ctx, connectionId)`: carga la conexión org-scoped (`notFound` si no es de la org), verifica estado `connected` (`conflict` si no) y que tenga `phone_number_id`
- [x] 4.2.2 Recorre todas las páginas de Kapso para ese `phone_number_id`; mapea `wa_id → phone` (antepone `+`), `profile_name → first_name` (fallback `display_name`, luego el teléfono), `last_name=null`, `source="whatsapp"`
- [x] 4.2.3 Omite contactos sin `wa_id` (o no normalizable); dedup por `(org, phone)` con skip (también dentro del lote); cuenta cada categoría
- [x] 4.2.4 Devolver reporte `{ imported, skippedNoPhone, skippedDuplicate }`; schemas `WhatsappImportInput`/`WhatsappImportReport`

### 4.3 REST API
- [x] 4.3.1 `POST /orgs/{orgId}/contacts/import/whatsapp` (body `{ connectionId }`) → devuelve el reporte

### 4.4 UI
- [x] 4.4.1 Acción "Importar de WhatsApp": diálogo con selector de conexión `connected` de la organización + disparo de la importación
- [x] 4.4.2 Mostrar reporte (importados / omitidos sin teléfono / omitidos duplicados); copy en español neutral

### 4.5 Verificación Fase 4
- [x] 4.5.1 `pnpm lint` y `pnpm build`
- [x] 4.5.2 Verificar contra Kapso (requiere credenciales + número conectado): importación acotada al `phone_number_id` elegido; omisión de contactos sin `wa_id`; dedup idempotente; rechazo de conexión ajena o no conectada — verificado en runtime por el usuario (incluye fix de la base Meta `/v24.0`)

## Context

Notify es multi-tenant: la organización del path (`/api/v1/orgs/:orgId/...`) es la fuente única de verdad. La arquitectura separa dominio (`web/lib/services/`) de transporte (rutas Hono y Server Components/Actions), con `TenantServiceContext` inyectando `db`, `currentOrg`, etc. Los servicios son módulos puros: NO importan `next/*` ni `hono`. Los errores de dominio se lanzan con `DomainErrors.{unauthorized,forbidden,notFound,conflict}` y el handler global los traduce a HTTP. Los schemas de input/output viven en `lib/services/<dominio>/schemas.ts` y se reutilizan en `createRoute(...)`.

Esta capability se apoya en piezas ya existentes:
- `whatsapp_connection` (1 org → N conexiones), con `phone_number_id` por conexión `connected`. La importación desde WhatsApp lee una conexión concreta de la organización para obtener su `phone_number_id`.
- Adaptador Kapso `web/lib/integrations/kapso/` (cliente `fetch` tipado, `KAPSO_API_KEY`). Se extiende con la lectura de contactos de Meta vía Kapso.

Superficies de Kapso relevantes (verificado en docs de Kapso):
- **Meta proxy** `GET /meta/whatsapp/{phone_number_id}/contacts` — paginación por cursor (`limit`≤100, `after`/`before`). Devuelve por contacto: `wa_id` (E.164, **puede ser null**), `profile_name`, `display_name`, `business_scoped_user_id`, `metadata`, timestamps. **Es la que usa la importación** porque está scopeada por `phone_number_id`.
- Platform `GET /whatsapp/contacts?customer_id=...` — scopeada por customer. **NO se usa**: mezclaría contactos de todos los números de la organización.

## Goals / Non-Goals

**Goals:**
- Gestión completa de contactos por organización con teléfono como identidad única (E.164).
- Listado paginado por offset y un paginador **reutilizable** para futuros módulos.
- Etiquetado N:M y filtro por etiqueta.
- Importación CSV (con dedup y reporte) y exportación CSV.
- Importación desde WhatsApp **siempre acotada a un `phone_number_id`** de la organización.
- Respetar la separación dominio/transporte y los patrones existentes (servicios puros, `DomainErrors`, zod-openapi, copy en español neutral).

**Non-Goals:**
- Envío de mensajes/notificaciones a contactos (capa de envío futura).
- Custom fields, segmentos guardados, dedup con merge interactivo.
- Sincronización continua automática desde WhatsApp (la importación es bajo demanda).
- Gating de contactos por plan (NO son entitlement facturado).
- Otras fuentes de importación (Google Contacts, vCard).

## Decisions

### D1. Paginación por OFFSET, con contrato de página explícito
El listado usa offset (`LIMIT/OFFSET` + `COUNT(*)`) y devuelve `{ items, page, pageSize, total, totalPages }`.
- **Por qué**: el feature exige botón "última página", número de página actual y selector de tamaño. Eso obliga a conocer el total → cursor queda descartado (no puede numerar ni saltar a la última). El volumen esperado (<10.000 contactos/org) hace que el coste de offsets profundos sea irrelevante.
- **Alternativa descartada**: cursor pagination — más escalable pero incompatible con los requisitos de UI del paginador.

### D2. Paginador como componente reutilizable y agnóstico de dominio
`components/ui/pagination.tsx` recibe `{ page, pageSize, total, pageSizeOptions, onPageChange, onPageSizeChange }` y NO conoce "contactos". Renderiza: primera ‹‹, anterior ‹, "página X de Y", siguiente ›, última ›› y un selector de `pageSize`. Deshabilita primera/anterior en la página 1 y siguiente/última en la última.
- **Por qué**: el requisito #11 lo pide explícitamente para otros módulos. Acoplarlo a contactos sería deuda inmediata.
- **Nota**: shadcn trae un `pagination` puramente presentacional sin selector de tamaño ni "primera/última"; construimos uno propio que cubre el contrato del feature (puede apoyarse en `Button`/`Select` ya instalados).

### D3. Teléfono como identidad: `UNIQUE(organization_id, phone)` en E.164
El teléfono se normaliza a E.164 con `libphonenumber-js` antes de persistir; la unicidad es por organización.
- **Por qué**: el producto notifica por WhatsApp; el teléfono ES la identidad y Meta exige E.164. Sin clave única no hay deduplicación posible en CSV ni en import.
- **Normalización**: se exige número parseable en formato internacional (con código de país). Los que no se puedan normalizar se **rechazan** (form manual) o se **reportan como error** (CSV). El `wa_id` de Kapso ya es E.164 (solo se antepone `+` si falta).
- **Alternativa descartada**: guardar el teléfono tal cual lo escribe el usuario — rompe dedup y envío.

### D4. Apellido nullable en DB; obligatorio solo en el formulario manual
La columna `last_name` es nullable. La obligatoriedad de apellido se valida **únicamente** en el schema del formulario de alta/edición manual, no en la constraint de DB.
- **Por qué**: la importación desde WhatsApp solo trae `profile_name` (un campo). Mapeamos `profile_name → first_name` y dejamos `last_name` vacío. Forzar NOT NULL obligaría a inventar placeholders sucios. Así dos caminos de entrada con contratos distintos (form estricto vs import tolerante) conviven sin pelear.

### D5. Importación desde WhatsApp acotada a un `phone_number_id`
La importación recibe el `id` de una conexión de WhatsApp de la organización; el servicio verifica que la conexión pertenece a la org y está `connected`, obtiene su `phone_number_id` y llama a Kapso `GET /meta/whatsapp/{phone_number_id}/contacts`, recorriendo todas las páginas por cursor.
- **Por qué (directiva explícita)**: una organización puede tener N números; importar por `customer_id` mezclaría contactos de todos. Acotar por `phone_number_id` ata cada importación a una conexión concreta y mantiene el aislamiento.
- **Mapeo**: `wa_id → phone` (anteponer `+`), `profile_name → first_name`, `last_name = null`, `source = "whatsapp"`. `display_name` se usa como `first_name` solo si `profile_name` viene vacío.
- **Contactos sin `wa_id`** (identidad solo BSUID de Meta): se **omiten** y se cuentan en el reporte. Nunca se crea un contacto sin la clave.
- **Deduplicación**: por `(organization_id, phone)`. Los que ya existen se **omiten** (no se sobrescriben) y se cuentan como omitidos-duplicados.
- **Reporte**: `{ imported, skippedNoPhone, skippedDuplicate }`.

### D6. Importación CSV: deduplicar por omisión (skip), nunca sobrescribir
El CSV se parsea por cabeceras (`nombres`, `apellidos`, `telefono`, `email`, `direccion`, `ciudad`, `empresa`). Cada fila se valida y su teléfono se normaliza. Política de duplicados: **omitir** (skip) las filas cuyo teléfono ya existe en la organización.
- **Por qué**: sobrescribir silenciosamente pisaría datos sin consentimiento. Skip + reporte es el comportamiento seguro y predecible.
- **Reporte**: `{ imported, skippedDuplicate, invalid: [{ row, reason }] }`. Filas con teléfono ausente o no normalizable, o sin nombres → `invalid` (no detienen el resto del lote).
- **Alternativa descartada**: upsert por defecto — útil pero arriesgado; se documenta como mejora futura opcional.

### D7. Autorización por membresía (sin distinción de rol en este alcance)
Cualquier miembro de la organización (`owner`/`admin`/`member`) puede listar, crear, editar, eliminar contactos y etiquetas, e importar/exportar. El aislamiento por organización es estricto (todas las queries filtran por `currentOrg.id`).
- **Por qué**: los contactos son **datos operativos**, no configuración de la organización; restringir por rol no está en el feature y sería inventar requisitos. El control de acceso necesario es la **membresía** (vía `requireOrgMembership`) y el aislamiento por org.
- **Extensible**: si más adelante se quiere gatear la eliminación o la importación a owner/admin, se añade una acción de dominio sin tocar el modelo de datos.

### D8. Etiquetas N:M, scoped por organización, filtro por etiqueta
`tag` (única por `name` dentro de la org) y `contact_tag` (join, PK compuesta `contact_id + tag_id`, ambas FKs cascade). El filtro del listado acepta un `tagId`: devuelve los contactos que tienen esa etiqueta.
- **Por qué**: N:M es el modelo natural ("una o varias etiquetas"). La unicidad por nombre evita etiquetas duplicadas por org.
- **Alcance del filtro**: por una etiqueta (coincide con el requisito literal "filtrar por etiqueta"). El filtro multi-etiqueta (OR/AND) queda como extensión futura del mismo endpoint (el parámetro puede evolucionar a lista sin romper el contrato).

### D9. Provenance: columna `source`
`contact.source` (`manual | csv | whatsapp`) registra el origen.
- **Por qué**: dato barato y útil para depurar importaciones y, a futuro, métricas. No añade complejidad.

## Risks / Trade-offs

- **Normalización de teléfonos locales sin código de país** → no se pueden convertir a E.164 de forma fiable. Mitigación: exigir formato internacional y reportar como inválidas las filas no parseables; el formulario manual guía con placeholder `+57...`. (Una mejora futura sería un selector de país por defecto en la organización.)
- **Offsets profundos** → con decenas de miles de filas, `OFFSET` alto es más lento. Aceptado: el volumen esperado (<10k/org) lo hace irrelevante; si crece, se indexa por `(organization_id, created_at, id)` y, en último caso, se evalúa keyset para "siguiente/anterior".
- **Importación WhatsApp parcial** → si la llamada a Kapso falla a mitad de la paginación, los contactos ya creados permanecen (la operación no es transaccional sobre todo el lote). Mitigación: dedup por teléfono hace la importación **idempotente** (reintentar no duplica); el reporte refleja lo efectivamente creado.
- **Contactos sin teléfono en WhatsApp** → se omiten; el usuario podría esperar verlos. Mitigación: el reporte indica el número de omitidos explícitamente.
- **CSV malformado / inyección de fórmulas** → al exportar, prefijar con `'` los campos que empiezan por `= + - @` para evitar CSV injection; al importar, tratar todo como texto. 

## Migration Plan

1. Añadir tablas `contact`, `tag`, `contact_tag` a `web/lib/db/schema.ts` con `UNIQUE(organization_id, phone)` y `UNIQUE(organization_id, name)` en tags; generar migración (`pnpm drizzle-kit generate`) y verificar el SQL. Aditiva y compatible hacia atrás.
2. Añadir `libphonenumber-js` a `web/package.json`.
3. No se requieren nuevas variables de entorno (se reutiliza `KAPSO_API_KEY`).
4. Rollback: aditivo; revertir = quitar rutas/servicio/UI y, si se desea, drop de tablas. Sin datos de producción que migrar.

## Phasing (delivery)

Cada fase es un slice revisable por PR independiente (work-unit commits), dentro del presupuesto de ~400 líneas de review. Cada fase deja la app funcional.

| Fase | Alcance | Entregable |
|------|---------|------------|
| **1** | Esquema `contact` + servicio CRUD + listado paginado (offset) + REST CRUD + UI listado/form + **paginador reutilizable** + card del dashboard | Contactos manuales funcionando de punta a punta |
| **2** | Esquema `tag`/`contact_tag` + servicio etiquetas + asignación + filtro por etiqueta + REST + UI | Etiquetado y filtrado |
| **3** | Exportación CSV + importación CSV (normalización, dedup-skip, reporte) + UI | Import/export CSV |
| **4** | Extensión adaptador Kapso `listContacts(phoneNumberId)` + servicio import WhatsApp (acotado a `phone_number_id`, omite sin `wa_id`, dedup) + REST + UI (elegir conexión) | Importación desde WhatsApp |

Las fases 2-4 dependen del modelo y los patrones que fija la fase 1.

## Open Questions

Resueltas para este cambio:
- ~~¿Cursor o offset?~~ → **OFFSET** (D1), por los requisitos del paginador.
- ~~¿Apellido obligatorio en DB?~~ → **Nullable en DB**, estricto solo en form manual (D4).
- ~~¿Import por customer o por número?~~ → **Por `phone_number_id`** (D5), directiva explícita del usuario.
- ~~¿Política de duplicados en import?~~ → **Skip + reporte**, nunca sobrescribir (D5, D6).
- ~~¿Contactos sin teléfono al importar?~~ → **Omitir + reportar** (D5).
- ~~¿Gating por plan?~~ → **No**; solo conteo en dashboard.
- ~~¿Roles para gestionar contactos?~~ → **Membresía** sin distinción de rol en este alcance (D7).
- Filtro multi-etiqueta (OR/AND): **fuera de alcance**; el endpoint queda preparado para evolucionar (D8).

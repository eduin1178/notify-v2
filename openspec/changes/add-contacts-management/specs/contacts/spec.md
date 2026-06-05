## ADDED Requirements

### Requirement: Modelo de contacto y atributos

El sistema SHALL gestionar contactos asociados a una organización con los atributos: `nombres`, `apellidos`, `teléfono`, `email`, `dirección`, `ciudad` y `empresa`. Únicamente `nombres` y `teléfono` SHALL ser obligatorios en el alta manual; en el alta manual el `apellido` también SHALL ser obligatorio. El resto de atributos SHALL ser opcionales. Cada contacto SHALL pertenecer a exactamente una organización y el acceso SHALL estar aislado por organización.

#### Scenario: Alta con los campos mínimos
- **WHEN** un miembro registra un contacto con nombres, apellidos y teléfono válidos
- **THEN** el sistema crea el contacto en la organización del path y devuelve sus datos

#### Scenario: Alta sin un campo obligatorio del formulario
- **WHEN** un miembro envía el formulario de alta sin nombres, sin apellidos o sin teléfono
- **THEN** el sistema rechaza la operación con un error de validación e indica el campo faltante

#### Scenario: Aislamiento entre organizaciones
- **WHEN** se solicitan los contactos de una organización
- **THEN** el sistema devuelve únicamente los contactos de esa organización y nunca los de otra

### Requirement: Teléfono como identidad única por organización

El sistema SHALL tratar el teléfono como la identidad del contacto. El teléfono SHALL normalizarse a formato E.164 antes de persistirse y SHALL ser único dentro de la organización (`UNIQUE(organization_id, phone)`). Un teléfono que no pueda normalizarse a E.164 SHALL rechazarse.

#### Scenario: Teléfono no normalizable
- **WHEN** un miembro intenta crear un contacto con un teléfono que no puede convertirse a E.164
- **THEN** el sistema rechaza la operación con un error de validación

#### Scenario: Teléfono duplicado en la misma organización
- **WHEN** un miembro intenta crear un contacto cuyo teléfono normalizado ya existe en la organización
- **THEN** el sistema rechaza la operación con un error de tipo `conflict`

#### Scenario: Mismo teléfono en organizaciones distintas
- **WHEN** dos organizaciones distintas registran un contacto con el mismo teléfono
- **THEN** el sistema permite ambos, porque la unicidad es por organización

### Requirement: Edición y eliminación de contactos

El sistema SHALL permitir a un miembro de la organización modificar y eliminar contactos existentes de esa organización. La edición SHALL re-validar y re-normalizar el teléfono y respetar la unicidad por organización.

#### Scenario: Edición de un contacto
- **WHEN** un miembro modifica los datos de un contacto de su organización
- **THEN** el sistema persiste los cambios tras validarlos

#### Scenario: Edición que colisiona con otro teléfono
- **WHEN** un miembro cambia el teléfono de un contacto a uno que ya pertenece a otro contacto de la misma organización
- **THEN** el sistema rechaza la operación con un error de tipo `conflict`

#### Scenario: Eliminación de un contacto
- **WHEN** un miembro elimina un contacto de su organización
- **THEN** el sistema elimina el contacto y sus asignaciones de etiqueta asociadas

### Requirement: Listado paginado por offset

El sistema SHALL exponer el listado de contactos de una organización paginado por offset, devolviendo en cada respuesta los elementos de la página y los metadatos `page`, `pageSize`, `total` y `totalPages`. El listado SHALL aceptar los parámetros `page` y `pageSize`.

#### Scenario: Solicitud de una página
- **WHEN** un miembro solicita el listado con `page` y `pageSize` dados
- **THEN** el sistema devuelve los contactos de esa página junto con `total` y `totalPages` calculados sobre el conjunto de la organización

#### Scenario: Página fuera de rango
- **WHEN** se solicita una `page` mayor que `totalPages`
- **THEN** el sistema devuelve una lista de elementos vacía con los metadatos correctos

### Requirement: Paginador reutilizable

El sistema SHALL proveer un componente de paginación reutilizable, agnóstico del dominio, destinado a usarse en otros módulos. El componente SHALL mostrar, a la izquierda, botones para ir a la primera página, a la página anterior, a la siguiente y a la última, con el número de la página actual entre ellos; y a la derecha, un selector del número de registros por página. Los botones de avanzar/retroceder SHALL habilitarse o deshabilitarse según corresponda a la posición actual.

#### Scenario: En la primera página
- **WHEN** el usuario está en la primera página
- **THEN** los botones "primera" y "anterior" están deshabilitados y los de "siguiente" y "última" habilitados (si hay más de una página)

#### Scenario: En la última página
- **WHEN** el usuario está en la última página
- **THEN** los botones "siguiente" y "última" están deshabilitados y los de "primera" y "anterior" habilitados (si hay más de una página)

#### Scenario: Cambio de tamaño de página
- **WHEN** el usuario elige otro número de registros por página en el selector
- **THEN** el listado se recalcula con el nuevo `pageSize`

### Requirement: Conteo de contactos en el dashboard

El sistema SHALL mostrar en el dashboard de la organización una card con la cantidad total de contactos de esa organización.

#### Scenario: Card de conteo
- **WHEN** un miembro abre el dashboard de su organización
- **THEN** el sistema muestra una card con el número total de contactos de la organización

### Requirement: Etiquetas de contacto (N:M)

El sistema SHALL permitir crear etiquetas a nivel de organización, con nombre único dentro de la organización, y asignar una o varias etiquetas a un contacto. Una etiqueta SHALL poder estar asignada a múltiples contactos y un contacto SHALL poder tener múltiples etiquetas.

#### Scenario: Crear y asignar etiquetas
- **WHEN** un miembro asigna una o varias etiquetas a un contacto de su organización
- **THEN** el sistema persiste las asignaciones y el contacto refleja sus etiquetas

#### Scenario: Etiqueta con nombre duplicado
- **WHEN** un miembro intenta crear una etiqueta cuyo nombre ya existe en la organización
- **THEN** el sistema rechaza la operación con un error de tipo `conflict`

#### Scenario: Quitar una etiqueta de un contacto
- **WHEN** un miembro quita una etiqueta asignada a un contacto
- **THEN** el sistema elimina esa asignación sin borrar la etiqueta ni el contacto

### Requirement: Filtrado de contactos por etiqueta

El sistema SHALL permitir filtrar el listado paginado de contactos por etiqueta, devolviendo únicamente los contactos que tienen la etiqueta indicada, con los mismos metadatos de paginación calculados sobre el subconjunto filtrado.

#### Scenario: Filtrar por una etiqueta
- **WHEN** un miembro solicita el listado filtrando por una etiqueta de su organización
- **THEN** el sistema devuelve solo los contactos que tienen esa etiqueta, paginados, con `total` y `totalPages` referidos al subconjunto filtrado

### Requirement: Exportación de contactos a CSV

El sistema SHALL permitir exportar los contactos de una organización a un archivo CSV con cabeceras para todos los atributos. La exportación SHALL neutralizar fórmulas (prefijo de seguridad en campos que comiencen por `=`, `+`, `-` o `@`) para evitar inyección de fórmulas CSV.

#### Scenario: Exportar contactos
- **WHEN** un miembro solicita exportar los contactos de su organización
- **THEN** el sistema genera un CSV con los contactos de esa organización y sus atributos en columnas

### Requirement: Importación de contactos desde CSV

El sistema SHALL permitir importar contactos desde un archivo CSV, mapeando las columnas a los atributos del contacto. Por cada fila, el sistema SHALL normalizar el teléfono a E.164 y validar los campos obligatorios. La deduplicación SHALL realizarse por `(organización, teléfono)`: las filas cuyo teléfono ya existe SHALL omitirse sin sobrescribir el contacto existente. Las filas inválidas (sin nombres, sin teléfono o con teléfono no normalizable) SHALL omitirse sin detener el lote. La operación SHALL devolver un reporte con el número de importados, omitidos por duplicado e inválidos (con su motivo).

#### Scenario: Importación con filas válidas e inválidas
- **WHEN** un miembro importa un CSV con filas válidas, filas con teléfono duplicado y filas sin teléfono
- **THEN** el sistema crea los contactos de las filas válidas nuevas, omite los duplicados y los inválidos, y devuelve un reporte con los conteos de cada categoría

#### Scenario: Reimportación idempotente
- **WHEN** un miembro reimporta un CSV ya importado previamente
- **THEN** el sistema omite todas las filas como duplicadas y no crea contactos nuevos

### Requirement: Importación desde WhatsApp acotada al phone_number_id

El sistema SHALL permitir importar contactos desde WhatsApp a través de Kapso, **siempre** acotando la importación al `phone_number_id` de una conexión de WhatsApp de la organización. El sistema SHALL verificar que la conexión indicada pertenece a la organización del path y está `connected` antes de importar, y SHALL recorrer todas las páginas de contactos de ese `phone_number_id`. Por cada contacto remoto, el sistema SHALL mapear `wa_id → teléfono` (en E.164) y `profile_name → nombres`. Los contactos remotos sin `wa_id` SHALL omitirse. La deduplicación SHALL realizarse por `(organización, teléfono)`, omitiendo los ya existentes. La operación SHALL devolver un reporte con importados, omitidos sin teléfono y omitidos por duplicado.

#### Scenario: Importación acotada a una conexión
- **WHEN** un miembro importa contactos indicando una conexión `connected` de su organización
- **THEN** el sistema consulta a Kapso únicamente los contactos del `phone_number_id` de esa conexión y crea los contactos nuevos con teléfono válido

#### Scenario: Conexión que no pertenece a la organización
- **WHEN** un miembro intenta importar usando una conexión que no pertenece a su organización
- **THEN** el sistema rechaza la operación con un error de tipo `notFound` o `forbidden` y no consulta a Kapso

#### Scenario: Conexión no conectada
- **WHEN** un miembro intenta importar usando una conexión de su organización que no está `connected`
- **THEN** el sistema rechaza la operación con un error de tipo `conflict` y no importa

#### Scenario: Contactos remotos sin teléfono
- **WHEN** la importación encuentra contactos remotos sin `wa_id` (identidad solo por BSUID)
- **THEN** el sistema los omite y refleja la cantidad omitida en el reporte, sin crear contactos sin teléfono

#### Scenario: Contactos remotos ya existentes
- **WHEN** la importación encuentra contactos remotos cuyo teléfono ya existe en la organización
- **THEN** el sistema los omite como duplicados sin sobrescribir los contactos existentes

### Requirement: Autorización por membresía de organización

El sistema SHALL permitir todas las operaciones sobre contactos y etiquetas (listar, crear, editar, eliminar, etiquetar, importar y exportar) a cualquier usuario que sea miembro de la organización del path. Los usuarios que no sean miembros SHALL ser rechazados.

#### Scenario: Miembro gestiona contactos
- **WHEN** un usuario miembro de la organización realiza cualquier operación sobre contactos o etiquetas
- **THEN** el sistema autoriza la operación

#### Scenario: Usuario no miembro
- **WHEN** un usuario que no es miembro de la organización del path intenta cualquier operación sobre contactos
- **THEN** el sistema rechaza la operación con un error de tipo `forbidden`

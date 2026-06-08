## ADDED Requirements

### Requirement: Búsqueda de contactos por nombre y teléfono

El sistema SHALL permitir buscar contactos del listado de una organización por un término que SHALL coincidir, de forma insensible a mayúsculas, contra el **nombre** (nombre y apellido) y contra el **número de teléfono** en formato E.164. La búsqueda SHALL combinarse con la paginación por offset existente, devolviendo `page`, `pageSize`, `total` y `totalPages` calculados sobre el conjunto de coincidencias, y SHALL poder combinarse con el filtrado por etiqueta. La búsqueda SHALL estar acotada a la organización del contexto.

#### Scenario: Coincidencia por nombre
- **WHEN** un miembro busca un término que coincide con el nombre o apellido de uno o más contactos
- **THEN** el sistema devuelve solo los contactos coincidentes, paginados, con `total` y `totalPages` calculados sobre las coincidencias

#### Scenario: Coincidencia por teléfono
- **WHEN** un miembro busca un término que coincide con el teléfono E.164 de un contacto
- **THEN** el sistema devuelve ese contacto entre las coincidencias

#### Scenario: Sin coincidencias
- **WHEN** un miembro busca un término que no coincide con ningún contacto de la organización
- **THEN** el sistema devuelve una lista vacía con los metadatos de paginación correctos

#### Scenario: Búsqueda combinada con etiqueta
- **WHEN** un miembro aplica a la vez un filtro de etiqueta y un término de búsqueda
- **THEN** el sistema devuelve solo los contactos que cumplen ambos criterios

#### Scenario: Aislamiento por organización
- **WHEN** un miembro busca contactos
- **THEN** el sistema nunca devuelve contactos de otra organización, aunque coincidan con el término

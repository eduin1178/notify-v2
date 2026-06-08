## ADDED Requirements

### Requirement: Header global del shell con excepción en el inbox

El shell autenticado SHALL renderizar un header superior con el control de
expandir/contraer el sidebar (`SidebarTrigger`) en las rutas autenticadas, EXCEPTO
en la ruta del inbox (`/inbox`), donde el header global superior NO SHALL
renderizarse para liberar el alto al layout de tres columnas. En la ruta del
inbox, el control `SidebarTrigger` SHALL permanecer accesible, reubicado e
integrado en la barra de la lista de conversaciones.

#### Scenario: Ruta no-inbox conserva el header global
- **WHEN** un usuario autenticado abre una ruta del shell distinta de `/inbox`
- **THEN** el shell renderiza el header global superior con el `SidebarTrigger`

#### Scenario: Inbox sin header global
- **WHEN** un usuario autenticado abre la ruta `/inbox`
- **THEN** el shell NO renderiza el header global superior

#### Scenario: Trigger accesible en el inbox
- **WHEN** un usuario autenticado está en la ruta `/inbox`
- **THEN** el control de expandir/contraer el sidebar permanece accesible, integrado en la barra de la lista de conversaciones

## ADDED Requirements

### Requirement: Vinculación manual de providers desde `/account`

El sistema SHALL permitir a un usuario autenticado vincular manualmente un provider OAuth (Google o GitHub) a su cuenta desde la página `/account`. La vinculación MUST reutilizar el flujo OAuth del provider y MUST asociar la cuenta resultante al `userId` de la sesión activa.

#### Scenario: Vincular GitHub a un usuario que solo tiene Google

- **WHEN** un usuario con sesión activa y solo Google vinculado activa "Vincular" sobre GitHub en `/account` y completa el consentimiento
- **THEN** el sistema crea una fila en `account` para GitHub asociada al mismo `userId`
- **AND** al volver a `/account` la UI refleja GitHub como vinculado

#### Scenario: Vinculación con email distinto

- **WHEN** un usuario vincula manualmente un provider cuyo email es distinto al de su cuenta
- **THEN** el sistema asocia el `account` al `userId` actual igualmente (la vinculación manual confía en la sesión activa, no en el email)

#### Scenario: Provider ya vinculado

- **WHEN** un usuario intenta vincular un provider que ya tiene vinculado
- **THEN** la UI NO MUST exponer el botón "Vincular" para ese provider

---

### Requirement: Desvinculación de providers con regla del último provider

El sistema SHALL permitir a un usuario autenticado desvincular un provider OAuth desde la página `/account`, EXCEPTO cuando ese provider sea el único vinculado a la cuenta. La regla "no puedes quedarte sin ningún provider" MUST aplicarse en el backend; el frontend MUST limitarse a invocar la operación y mostrar el error devuelto.

#### Scenario: Desvincular un provider cuando hay más de uno

- **WHEN** un usuario con Google y GitHub vinculados activa "Desvincular" sobre GitHub
- **THEN** el sistema elimina la fila de `account` correspondiente a GitHub
- **AND** la UI refleja GitHub como no vinculado

#### Scenario: Intento de desvincular el último provider

- **WHEN** un usuario con un único provider vinculado activa "Desvincular" sobre ese provider
- **THEN** el backend rechaza la operación con un error específico
- **AND** la fila en `account` no se elimina
- **AND** el frontend muestra el mensaje "No puedes desvincular tu único proveedor de acceso."

#### Scenario: Frontend no precomputa la regla

- **WHEN** la UI de `/account` se renderiza con un único provider vinculado
- **THEN** el botón "Desvincular" sigue presente y habilitado
- **AND** la decisión de rechazo ocurre al invocar la operación, no antes

## MODIFIED Requirements

### Requirement: Recepción de mensajes por webhook

El sistema SHALL recibir los eventos de Kapso `whatsapp.message.received`, `whatsapp.message.sent`, `whatsapp.message.delivered`, `whatsapp.message.read`, `whatsapp.message.failed` y `whatsapp.conversation.created|ended|inactive` en la ruta de webhook existente, verificando la firma antes de procesar. Al recibir un entrante (`received`), el sistema SHALL resolver la organización por `phone_number_id → whatsapp_connection`, hacer *upsert* de la conversación en el índice por `kapso_conversation_id`, actualizar `last_inbound_at`, el preview del último mensaje e incrementar el contador de no leídos. Tras confirmar el commit en la base de datos, el sistema SHALL publicar un evento de realtime en el canal de la organización y, cuando aplique, en el canal de la conversación. Un fallo de publicación de realtime NO SHALL provocar el fallo del procesamiento del webhook (es best-effort y no debe forzar reintentos de Kapso).

#### Scenario: Entrante crea o actualiza la conversación
- **WHEN** llega `whatsapp.message.received` para un número conocido de la organización
- **THEN** el sistema hace upsert de la conversación, actualiza `last_inbound_at` y el preview, e incrementa los no leídos

#### Scenario: Publicación de realtime tras commit
- **WHEN** el sistema termina de ingerir un entrante o un cambio de estado de entrega y confirma el commit
- **THEN** publica el evento correspondiente en `inbox:org.<orgId>` y, si aplica, en `inbox:conv.<conversationId>`

#### Scenario: Fallo de publicación no rompe el webhook
- **WHEN** la publicación a Centrífugo falla tras una ingesta confirmada
- **THEN** el webhook responde con éxito (la ingesta ya está persistida) y el fallo de publicación se registra sin propagarse

#### Scenario: Número desconocido
- **WHEN** llega un evento de mensaje cuyo `phone_number_id` no corresponde a ninguna conexión conocida
- **THEN** el sistema responde 200 y registra el evento como ignorado, sin crear datos

#### Scenario: Firma inválida
- **WHEN** llega una petición al webhook con firma inválida o ausente
- **THEN** el sistema responde 401 y no procesa el evento

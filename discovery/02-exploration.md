# Notify — Exploración del dominio

> Investigación de descubrimiento previa a `proposal`. Insumo para los siguientes pasos del flujo OpenSpec/SDD. **No es una spec.** No define alcance del MVP — solo mapea el territorio.

Contexto: plataforma WhatsApp de mensajería masiva + automatización + CRM básico, multi-tenant, vendible como SaaS por un comercializador a sus clientes finales (pymes: dropshipping, educación online, agencias de marketing, servicios).

---

## 1. Capabilities típicas en este sector

Bounded contexts candidatos (no equivale al alcance MVP, equivale al territorio que el dominio cubre en plataformas comparables como ManyChat, Wati, Respond.io, Sendbird, Zenvia, Trengo).

### Núcleo de plataforma
- **Identity & Access** — usuarios, sesiones, social login, MFA, password reset.
- **Tenancy** — organizaciones, membresías, roles, invitaciones. La organización ES el tenant; no existe un nivel de "workspace" debajo.
- **Billing** — planes, suscripciones, cuotas, consumo, overage, métodos de pago, facturación.

### Audiencia (CRM)
- **Contacts** — alta, normalización E.164, dedupe por organización, custom fields.
- **Tags** — etiquetado N:N.
- **Segments** — listas dinámicas (por reglas) y estáticas (por selección).
- **Imports** — CSV/XLSX, mapeo de columnas, validación, reporte de errores.
- **Consent / Opt-in / Opt-out (DNC)** — registro de consentimiento, fuente, fecha, manejo de `STOP`.

### Mensajería
- **Channels** — números/líneas de WhatsApp asociadas a la organización, con tipo de provider (Cloud API o Waha).
- **Templates** — cuerpo, variables, multimedia, estado de aprobación (Cloud API), categorías.
- **Messaging Gateway** — capa anti-corrupción que expone un `MessagingPort` y oculta los adapters específicos.
- **Outbound / Inbound / Status** — envío, recepción, eventos de entrega/lectura/falla.

### Campañas y programación
- **Campaigns** — broadcast a un segmento usando una plantilla, con estado y recipient-level tracking.
- **Scheduled Sends** — mensajes individuales programados a fecha/hora.
- **Job Queue** — cola con reintentos, idempotencia, rate limiting por canal.

### Automatización
- **Webhook Receiver** — endpoints públicos por organización para landings, Meta Ads, formularios, terceros.
- **Triggers** — eventos que disparan flujos (webhook recibido, tag asignada, mensaje recibido, fecha/hora).
- **Flows** — pipeline `Evento → Condiciones → Acciones[]` con tipado cerrado de acciones.
- **Flow Runs** — instancia ejecutándose para un Contact, durable, con estado.

### Conversaciones
- **Inbox** — bandeja de respuestas en tiempo real.
- **Conversation state** — abierta, snoozed, resuelta, asignación a operador.
- **Real-time presence** — qué operador está viendo qué conversación (post-MVP).

### Operación y observabilidad
- **Analytics / Reporting** — entregas, lecturas, CTR, tasas de respuesta, conversión, costo por canal.
- **Audit Log** — quién hizo qué, cuándo (compliance, debugging, soporte).
- **Admin / Internal Tools** — visibilidad del consumo por organización, alertas de margen, soporte (acceso del rol SuperAdmin de EduNet).

---

## 2. Entidades de dominio comunes

Modelo candidato agrupado por bounded context.

```
Identity & Tenancy
├── User                         (puede tener role global = super_admin para staff de EduNet)
├── Organization                 (TENANT — cuenta de billing y espacio operativo a la vez)
├── OrgMembership                (User × Org × role: owner | admin | member)
├── MemberPermission             (membership_id × permission_key, allow|deny — solo para role=member)
├── Invitation
└── ApiKey

CRM
├── Contact                      (organization_id, phone E.164, name, custom_fields, locale, tz)
├── Tag                          (organization_id, name, color)
├── ContactTag                   (N:N)
├── Segment                      (organization_id, type: static|dynamic, rule_json)
├── ImportJob                    (status, mapping, errors_report)
└── ConsentRecord                (contact_id, source, opted_in_at, opted_out_at)

Messaging
├── Channel                      (organization_id, phone, provider: cloud_api|Waha, status)
├── Template                     (organization_id, body, variables, media, status, requires_approval)
├── Conversation                 (organization_id, contact_id, channel_id, status, assigned_to)
├── Message                      (conversation_id, direction, body, media, provider_message_id)
└── DeliveryEvent                (message_id, kind: sent|delivered|read|failed, at)

Campaigns & Scheduling
├── Campaign                     (organization_id, template_snapshot, segment_id, schedule, status)
├── CampaignRecipient            (campaign_id, contact_id, status, provider_message_id)
├── ScheduledSend                (organization_id, contact_id, template_id, send_at, status)
└── SendAttempt                  (parent_id, attempt_n, error, next_retry_at)

Automation
├── WebhookEndpoint              (organization_id, slug, secret, mapping)
├── Trigger                      (kind: webhook|tag_added|message_received|scheduled)
├── Flow                         (organization_id, trigger_id, conditions_tree, actions: [])
├── FlowRun                      (flow_id, contact_id, status, current_step, payload)
└── FlowStepResult               (flow_run_id, step_idx, status, output, error)

Billing
├── Plan                         (name, monthly_price, included_messages, overage_price, limits)
├── Subscription                 (organization_id, plan_id, status, period)
├── UsageRecord                  (organization_id, period, kind, count, est_cost_usd)
└── Invoice                      (organization_id, period, line_items, total)
```

**Invariantes clave**:
- La **`Organization` es el único nivel de tenant**. Un `User` puede pertenecer a una o varias organizaciones con un rol distinto en cada una. No existe el concepto `Workspace` debajo de la organización.
- `Contact` es único por `(organization_id, phone)`. Nunca global.
- `Template` se **snapshot-ea** dentro de `Campaign` al lanzar, no se referencia viva (evita inconsistencia si el template cambia/se rechaza durante la campaña).
- `Conversation` es única por `(organization_id, contact_id, channel_id)`.
- Billing, plan, cuotas y pool de mensajes viven a nivel `Organization`.

**Modelo de roles (4 roles totales)**:

| Rol | Alcance | Quién | Qué puede hacer |
|-----|---------|-------|-----------------|
| `super_admin` | Global (toda la plataforma) | Staff de EduNet y sus agentes | Visibilidad y administración cross-tenant: consumo, soporte, suspensión de organizaciones, métricas de negocio. NO es un rol de organización; vive como atributo del `User`. |
| `owner` | Organización | Quien crea la organización | Todos los permisos dentro de su organización, incluyendo billing, transferir propiedad y eliminar la organización. Solo uno por organización (transferible). |
| `admin` | Organización | Designado por el `owner` | Gestiona usuarios y roles dentro de la organización (excepto el rol `owner`), configura canales, plantillas, automations, campañas. No puede tocar billing crítico ni eliminar la organización. |
| `member` | Organización | Invitado por `owner`/`admin` | Permisos específicos sobre funcionalidades **concedidos o denegados explícitamente** por un `admin`/`owner` (ver entidad `MemberPermission`). Sin permisos por defecto. |

---

## 3. Patrones arquitectónicos frecuentes

### Hexagonal / Ports & Adapters para messaging
Dado que conviven Cloud API oficial y Waha (no oficial) — y mañana puede sumarse otro BSP —, el dominio NO debe conocer al provider.

```
domain (puro)
   └── MessagingPort
            ├─ outbound: send(channel, contact, template, vars) → providerMessageId
            ├─ inbound:  onMessage(channel) → DomainEvent
            └─ status:   onStatus(providerMessageId, kind) → DomainEvent

infrastructure
   ├── CloudApiAdapter   (templates aprobadas, ventana 24h, conversation cost)
   └── WahaAdapter    (sesión QR, free-form, opt-in con disclaimer)
```

### Multi-tenant con doble nivel de aislamiento
- **Filtro por repositorio**: middleware injecta `current_user_id` y `current_organization_id` en un context. Repositorios siempre filtran por `organization_id`. Tests específicos verifican leak cero entre organizaciones.
- **No** usar Postgres RLS en MVP (Better-Auth no es Supabase, y RLS con `SET LOCAL` agrega complejidad). Diferir a cuando lo justifique.

### Event-driven local con outbox
Acciones que cruzan boundaries (campaña enviada, automation completada, mensaje entrante) se publican como eventos. Patrón **transactional outbox** evita "publiqué pero la transacción rolleó".

### Pipeline imperativo lineal para Automation
No DAG, no Temporal, no n8n-light. `Trigger → Conditions(AND/OR tree) → Actions[]` ejecutadas en orden. Tipos de acción cerrados:
- `add_tag` / `remove_tag`
- `update_contact_field`
- `wait` (duración)
- `http_request`
- `send_message` (template)
Cada `FlowRun` se modela como **task durable** en Trigger.dev — `wait` es nativo.
Pueden agregarse tipos de acción más adelante, por lo que la arquitectura debe ser extensible.

### Job queue con rate limiting por canal
Un canal de WhatsApp tiene límites (Cloud API tiers, Waha más estricto). El scheduler envía respetando un bucket por `channel_id`, no global.

### Snapshots para artefactos enviados
- `CampaignRecipient` referencia un snapshot del template al momento del lanzamiento.
- `Message` guarda el body renderizado, no solo `template_id` + variables.
- `UsageRecord` es append-only por período.

### Webhook receiver hardened
- Verificación HMAC + timestamp tolerance + replay protection (idempotency-key).
- Respuesta 200 inmediata + procesamiento asíncrono via Trigger.dev.
- Mapeo declarativo `payload → event/contact/tags` (no código por cliente).

### Realtime dual-track
- **Pusher** para Inbox (channels + presence).
- **Trigger.dev Realtime** para estado de tasks (campañas en progreso, FlowRuns).

---

## 4. Riesgos típicos del dominio

Priorizados por impacto sobre el negocio:

| # | Riesgo | Por qué duele | Mitigación temprana |
|---|--------|--------------|---------------------|
| 1 | Baneo de números en Waha/no-oficial | Cliente final pierde el número de su empresa. Demanda al revendedor. | Disclaimer firmado al activar Waha. Educación en UX. Cloud API por defecto. |
| 2 | Confundir "masivo" con "broadcast oficial" | Cloud API exige plantillas pre-aprobadas + ventana 24h + opt-in. Mandar a una lista fría = bloqueo del número. | Diseñar flujo opt-in antes que el de broadcast. UX bloquea envío sin plantilla aprobada. |
| 3 | No modelar consent/opt-out desde día 1 | Multas (Habeas Data CO ley 1581, LGPD, GDPR), bloqueo de número, denuncias. | `ConsentRecord` y handler `STOP` en MVP, no en v2. |
| 4 | Cola de envío naive | Bloqueo por rate limit. Mensaje programado a las 9:00 sale a las 9:47. Duplicados. | Trigger.dev con rate-limit por channel, idempotency keys, backoff exponencial. |
| 5 | Webhook receiver sin verificación de firma | Cualquiera dispara automatizaciones falsas. Spam interno, fraude, costo. | HMAC + timestamp + replay protection desde el endpoint inicial. |
| 6 | Multi-tenant lógico que filtra entre tenants | Bug filtra contactos de una organización a otra → fin del negocio. | `organization_id` en TODA tabla. Repository pattern que lo inyecta siempre. Tests específicos de aislamiento entre organizaciones. |
| 7 | Automation sin límites | Loops infinitos, recursión, costos descontrolados. | Pipeline lineal (no DAG), max-actions por flow, timeout por FlowRun, sin loops. |
| 8 | No separar template approval del envío | Meta rechaza la plantilla mientras la campaña corre → mitad enviada con plantilla vieja. | Snapshot del template en `Campaign` al lanzar. |
| 9 | Inbound replies ignorados | "Esto no sirve, la gente me responde y no veo nada." | Inbox in-scope. Política bot-vs-humano explícita: humano pausa automations. |
| 10 | Costos de Cloud API mal contabilizados | Cobra por **conversación** por categoría (marketing/utility/auth/service). Cobrar por mensaje al cliente final puede dejarte perdiendo plata. | Doble track: cobrás "mensaje saliente" al cliente, trackeás conversación internamente. Alertas de margen <20%. |
| 11 | PII sin protección | Bases con teléfonos + nombres + tags → leak = catástrofe legal y reputacional. | Cifrado en reposo de columnas sensibles, backups cifrados, retention policy. |
| 12 | Acoplar adapter de provider al dominio | Cuando Waha muera o Meta cambie API → reescribís todo. | Hexagonal con `MessagingPort` agnóstico. |
| 13 | Realtime frágil con Neon serverless | Neon cierra conexiones idle agresivamente. Inbox que se desconecta cada 30s. | Pusher para Inbox. NO `LISTEN/NOTIFY` directo en MVP. |
| 14 | Plantillas rechazadas por Meta sin feedback al usuario | Usuario crea plantilla, no entiende por qué no envía. | Status visible (`pending/approved/rejected`) + razón del rechazo + reenvío. |
| 15 | Importación CSV con formatos sucios | E.164 inválidos, duplicados, encoding, columnas mapeadas mal → datos basura. | Validación + dry-run + reporte de errores antes de commit. |

---

## 5. Decisiones tempranas a considerar

Ya tomadas en este descubrimiento (registradas en engram):

| # | Decisión | Resolución |
|---|----------|------------|
| 1 | Provider WhatsApp | Dual: Cloud API + Waha, vía `MessagingPort` |
| 2 | Multi-tenant | **Organización como único tenant** (sin nivel `Workspace` debajo). Un `User` puede pertenecer a varias organizaciones. |
| 3 | Inbox | In-scope desde MVP |
| 4 | Motor de automatización | Pipeline imperativo `Event → Conditions → Actions[]` |
| 5 | Stack base | Next.js 16 + shadcn |
| 6 | Pricing | 3 planes (Starter/Pro/Enterprise) + paquete incluido + overage |
| A | Modelo de roles | 4 roles totales: `super_admin` (global, staff de EduNet), `owner` (creador de la organización), `admin` (gestiona usuarios y roles excepto `owner`), `member` (permisos explícitos asignados por admin/owner). |
| B | Postgres | Neon (serverless, branching) |
| C | Background jobs | Trigger.dev v3 |
| D | Auth | Better-Auth + plugin Organizations/Teams |
| E | Bot vs humano en Inbox | Humano tiene prioridad. Asignación o `status=open` pausa automations. |
| F | Unidad de cobro | Mensaje saliente al cliente; tracking interno por conversación + categoría |
| G | Editor de automations | Form-based linear builder en MVP. Drag&drop visual diferido. |
| H | ORM | Drizzle |
| I | Realtime | Pusher (Inbox) + Trigger.dev Realtime (tasks) |

**Stack consolidado**:

```
Next.js 16 (App Router) + shadcn
Better-Auth + plugin Organizations/Teams
Drizzle ORM
Postgres @ Neon
Trigger.dev v3 (background + task realtime)
Pusher (chat realtime para Inbox)
Cloudflare R2 (storage)
WhatsApp: MessagingPort + CloudApiAdapter + WahaAdapter
```

---

## 6. Hallazgos que disparan preguntas nuevas al cliente

Durante la exploración aparecieron temas que el cliente NO mencionó pero que afectan el diseño. Antes de cerrar el `proposal` conviene validarlos.

### Sobre WhatsApp y reglas de Meta
1. **¿Tu cliente sabe que Cloud API exige plantillas pre-aprobadas y ventana de 24h para responder?** Esto cambia totalmente el flujo "marketing masivo" tradicional. Hay que validar que entiende y acepta la restricción, o si pretende usar Waha para todo eso (con riesgo de baneo).
2. **¿El cliente final aporta su propio número de WhatsApp Business verificado, o vos como revendedor sos un BSP intermediario?** Define el modelo de provisioning y quién paga la verificación de Meta.
3. **¿Disclaimer legal para activar Waha?** ¿Texto, aceptación con timestamp, o solo checkbox?

### Sobre Inbox y operación
4. **¿Cuántos operadores típicos tendrá una organización?** Define dimensiones del UI, modelo de asignación, plan límites.
5. **¿Quieren notas internas en conversaciones, menciones a otros operadores, SLA timers?** O eso es post-MVP.
6. **Cuando un mensaje cae en Inbox, ¿hay notificación push/email al operador, o solo se ve si está en la pantalla?**
7. **¿Hay horario de atención** (fuera del horario, ¿auto-respuesta, ruteo a otra cosa)?

### Sobre automatización
8. **¿Branching condicional dentro de las acciones?** (ej: "si HTTP devuelve 200 hacé X, si no, Y"). MVP propuesto: política global por flow (continuar / detener) sin branching.
9. **¿Variables compartidas entre acciones?** (ej: el `http_request` devuelve un id, la siguiente acción lo usa). Útil pero complejo.
10. **¿Disparar un flow desde otro flow?** O cada flow es independiente.

### Sobre CRM
11. **¿Qué custom fields esperan los usuarios finales?** (texto, número, fecha, dropdown, checkbox). MVP: texto + número + dropdown.
12. **¿Importación recurrente desde Google Sheets o solo CSV puntual?** Sheets sync es feature común pero pesada.
13. **Deduplicación de contactos**: estricta por organización (no hay nivel workspace).

### Sobre pricing y planes
14. **¿Cuál es el rango de precios objetivo de los 3 planes?** Define cuántos mensajes incluidos, cuántos contactos y cuántos operadores por plan.
15. **¿Cobro mensual, anual con descuento, ambos?**
16. **¿Trial gratuito? ¿Sandbox con número de prueba de Cloud API?**
17. **¿Cliente final paga por mensaje saliente "todo igual" o tarifa diferencial Cloud API vs Waha?** Cobrar igual te puede costar margen en Cloud API marketing.
18. **¿Quién absorbe el costo de mensajes "fallidos pero cobrados por Meta"?** (mensajes que entregan pero el destinatario no los abre dentro de 24h, etc.)

### Sobre identidad y onboarding
19. **¿Self-service signup o invitación manual?** El cliente como revendedor probablemente quiere onboarding asistido al inicio.
20. **¿Social login (Google) o solo email/password?**
21. **¿Idiomas soportados en la UI?** (ES por defecto, EN para escalar).

### Sobre arquitectura no resuelta
22. **¿Hay requisito de exportar datos** (cumplimiento GDPR/Habeas Data — derecho al portabilidad)?
23. **Retention policy**: ¿conversaciones se borran después de N meses? ¿Mensajes de campañas? ¿Tiene impacto legal?
24. **¿Webhook saliente** (notificar a sistemas del cliente cuando pasa algo en Notify)? No fue pedido pero es feature común que se pide a los 3 meses.
25. **¿API pública para que el cliente final integre con sus propios sistemas?** O solo dashboard.
26. **Multi-idioma de los mensajes salientes** (templates en varios idiomas, selección por contact.locale).

### Sobre confirmaciones técnicas pendientes
27. **Better-Auth plugin Organizations**: confirmar con context7 que cubre el modelo de tenancy de un solo nivel (organización) con roles `owner`/`admin`/`member`, y cómo modelar `super_admin` global (probablemente como atributo del `User`, fuera del plugin).
28. **Trigger.dev v3 Realtime**: confirmar que es production-ready para nuestro caso de tasks streaming.
29. **Drizzle adapter para Better-Auth**: confirmar que está estable.

---

## Próximo paso

Pasar a `proposal` con un cambio inicial (sugerido: `notify-mvp-foundation` o similar) que defina el alcance del MVP. Las 29 preguntas de la sección 6 son insumo para refinar ese alcance — no todas tienen que cerrarse antes, pero las relacionadas con Cloud API/Waha, Inbox y pricing sí.

# Visión del Proyecto: Notify

> **Fecha:** 2026-05-07
> **Autor:** Ingeniero de software (especificación y desarrollo)
> **Fuente:** `00-intake.md`, `01-questions.md` (incluye §12 con resolución de pendientes), `02-exploration.md`
> **Estado:** Documento de visión — insumo previo al `proposal` de OpenSpec/SDD.

---

## 1. Problema y oportunidad

Las pequeñas y medianas empresas latinoamericanas (dropshipping, educación online, agencias de marketing digital, servicios) necesitan automatizar su comunicación por WhatsApp, pero hoy resuelven el problema con **soluciones frágiles**: envíos manuales número por número, hojas de Google como CRM improvisado, automatizaciones armadas en n8n por personal técnico. El resultado es un proceso lento, propenso a errores, sin trazabilidad de consentimiento, y con riesgo permanente de baneo del número de WhatsApp por mal uso.

EduNet tiene clientes recurrentes (consultoría en marketing digital) que demandan esta capacidad como servicio de valor agregado, pero **no existe en el mercado local una plataforma simple, multi-tenant, que combine envíos masivos + automatización evento-condición-acción + CRM básico + Inbox bidireccional**, soportando tanto la API oficial de Meta (Cloud API) como APIs no oficiales (WAHA, EvolutionAPI) según el caso de uso.

La oportunidad es lanzar Notify como SaaS multi-inquilino vendido por EduNet bajo un modelo **BYO Cloud API account** (el cliente trae y paga su cuenta de Meta, EduNet cobra solo el acceso a la plataforma), con planes escalonados, en una ventana donde la demanda existe y los competidores globales (ManyChat, Wati, Respond.io) tienen pricing en USD y UX no adaptada al mercado hispanohablante. La fecha objetivo del primer prototipo funcional son **2 meses** desde el inicio del desarrollo.

---

## 2. Usuarios y roles

| Rol | Descripción | Acciones principales | Volumen estimado |
|-----|-------------|----------------------|------------------|
| **SuperAdmin** | Staff de EduNet y sus agentes. Rol global, no de organización. | Soporte cross-tenant, monitoreo de consumo, suspender organizaciones, métricas de negocio, configurar planes Enterprise. | 2–5 usuarios totales |
| **Owner** | Quien crea la organización (cliente final SaaS). | Gestionar billing, transferir propiedad, eliminar la organización, todos los permisos internos. | 1 por organización (transferible) |
| **Admin** | Designado por el Owner. | Gestionar usuarios y roles (excepto Owner), configurar canales, plantillas, automations, campañas. | 1–3 por organización |
| **Member (operador)** | Invitado por Owner/Admin con permisos explícitos. | Ejecutar campañas, gestionar contactos, atender Inbox según permisos otorgados. | 2–5 simultáneos por organización |
| **Contacto** | Destinatario final de los mensajes — NO es usuario de la plataforma. | Recibir/responder mensajes WhatsApp, opt-in/opt-out. | Estimado 1.000–5.000 por organización; **100 organizaciones objetivo al año 1** |

**Concurrencia agregada esperada**: hasta 100 usuarios simultáneos en momentos de pico.

---

## 3. Alcance del MVP

### Dentro

- **Identidad y tenancy multi-organización**: registro self-service + invitación por correo + login con Google + magic link. Una organización es el único nivel de tenant; un usuario puede pertenecer a varias.
- **4 roles**: SuperAdmin (global), Owner, Admin, Member (con permisos explícitos por feature).
- **CRM básico**: contactos (E.164 normalizado, dedupe estricto por organización), tags, campos personalizados (texto, número, fecha, dropdown, checkbox), importación CSV/XLSX puntual con validación y reporte de errores.
- **Consent management**: registro de opt-in con fuente y timestamp, opt-out automático (handler `STOP`), exclusión automática de campañas.
- **Canales WhatsApp duales bajo modelo BYO-account**: Cloud API oficial (cliente conecta su propia cuenta y paga directo a Meta; wizard de onboarding asistido) + WAHA/EvolutionAPI no oficial (con disclaimer aceptado y timestamp). Múltiples canales por organización.
- **Plantillas**: cuerpo, variables, multimedia, estado de aprobación visible (pending/approved/rejected con razón).
- **Campañas masivas**: broadcast a un segmento usando una plantilla, envío inmediato o programado, snapshot del template al lanzar, recipient-level tracking.
- **Mensajes programados**: a nivel campaña y a nivel mensaje individual, respetando rate limits del provider.
- **Webhook receiver**: endpoints públicos por organización con verificación HMAC + timestamp + replay protection. Mapeo declarativo payload → evento/contacto/tags.
- **Automation engine**: pipeline lineal `Evento → Condiciones (AND/OR) → Acciones[]`. Acciones cerradas: `add_tag`, `remove_tag`, `update_contact_field`, `wait`, `http_request`, `send_message`. Composición flow→flow permitida. Sin branching por resultado de acción intermedia. Sin variables compartidas entre acciones.
- **Inbox bidireccional**: bandeja con conversaciones, asignación a operador, notas internas, notificaciones push, horario de atención con auto-respuesta. **Bot de IA opcional con BYO-key OpenRouter** (modelo elegible por la organización; tokens los paga el cliente directo a OpenRouter), vinculable a campaña, con escalación a humano.
- **Billing y planes** (sin "mensajes incluidos"): 3 planes basados en límites operativos (contactos, canales, operadores, automations, retención, bot IA). Plan free para pruebas. Mensual y anual con 20% de descuento. **Cobro en Wompi** únicamente en MVP (arquitectura multi-gateway preparada).
- **Plan Enterprise configurable por SuperAdmin** con override manual de todos los límites.
- **Reportes**: enviados/fallidos, tasa de apertura, CTR, campañas activas, rendimiento por campaña. Reporte SuperAdmin de consumo y suscripciones cross-tenant.
- **Cumplimiento Habeas Data (Ley 1581 CO)**: exportación completa por contacto y por organización (JSON/CSV), borrado por solicitud, retención de mensajes 6 meses, conversaciones/consent/audit/métricas 12 meses.
- **UI responsiva web** (computadora + navegador móvil), idioma Español. Preset shadcn ya configurado; logo se incorpora durante MVP.
- **Audit log** de acciones administrativas.
- **Dominio**: `notify.edunet.com.co`.

### Fuera (explícitamente)

- App móvil nativa iOS/Android.
- API pública para integración externa del cliente final (diferida; arquitectura debe permitirla).
- Multi-idioma de UI (solo Español en MVP; arquitectura i18n-ready).
- Multi-idioma de plantillas (una organización = un idioma).
- Editor visual drag&drop de automations (form-based linear builder en MVP).
- Branching de acciones por resultado intermedio (`if http_request == 200 then…`).
- Variables compartidas entre acciones de un mismo flow.
- Sincronización recurrente con Google Sheets (solo CSV/XLSX puntual).
- Menciones `@usuario` en Inbox.
- SLA timers en Inbox.
- Notificaciones por correo al operador (solo push).
- Integraciones nativas con CRMs externos (HubSpot, Zoho, ActiveCampaign, Mailchimp).
- Integraciones con plataformas de cursos online (Hotmart, Teachable, LearnDash, Moodle).
- Detección de compras en pasarelas de pago para disparar mensajes.
- Postgres RLS (filtrado a nivel repositorio en MVP).
- Cumplimiento GDPR (solo Habeas Data CO; postergar hasta expansión a Europa).
- **Webhooks salientes a sistemas del cliente final** (diferido a post-MVP; integración propuesta con Svix cuando se implemente).
- **Reventa de mensajería / overage / "mensajes incluidos"**: EduNet NO intermedia el costo de mensajes. Cliente paga directamente a Meta (Cloud API) o asume su propia infraestructura WAHA/EvolutionAPI.
- **Tarifa diferencial Cloud API vs no-oficial**: irrelevante en MVP porque EduNet no factura mensajes.
- **MFA / 2FA** (diferido a post-MVP; factor adicional implícito vía Google OAuth y magic link).
- **Pasarelas múltiples**: solo Wompi en MVP (Polar.sh y otras se difieren).

---

## 4. Flujos principales (épicas)

### 4.1. Onboarding de organización
Un usuario se registra (self-service o invitación), crea o se une a una organización, activa su primer canal de WhatsApp mediante un **wizard tipo asistente bien documentado** (Cloud API: pega credenciales y completa la verificación con Meta a su cargo; o WAHA/EvolutionAPI: acepta disclaimer con timestamp). Plan free disponible para pruebas.
**Actores**: Owner, Admin, SuperAdmin (soporte).

### 4.2. Gestión de contactos y consentimiento
El Owner/Admin/Member importa contactos por CSV/XLSX o los recibe vía webhook desde landings/Meta Ads. El sistema normaliza a E.164, deduplica por organización, registra el consentimiento con fuente y timestamp, y permite etiquetado y campos personalizados.
**Actores**: Member, sistemas externos (webhooks).

### 4.3. Campaña masiva con plantilla
Un Member crea una campaña: selecciona segmento, plantilla (snapshotted al lanzar), define envío inmediato o programado. La cola de jobs respeta rate limit por canal. Cada destinatario tiene tracking individual de entrega/lectura/falla. Límites de la organización (contactos, canales, operadores) verificados antes del envío.
**Actores**: Member, sistema (job queue), proveedor WhatsApp.

### 4.4. Automation evento-condición-acción
Un evento (webhook recibido, tag asignada, mensaje recibido, fecha programada) dispara un flow. El motor evalúa condiciones sobre datos del contacto y ejecuta acciones lineales en orden. Un flow puede disparar otro flow.
**Actores**: sistema (Trigger.dev), sistemas externos.

### 4.5. Conversación bidireccional en Inbox
Un contacto responde un mensaje. Cae en el Inbox de la organización. Si hay un bot vinculado (con la API key de OpenRouter de la organización), atiende; si el contacto pide humano (o un operador toma la conversación), el bot se pausa. Operador agrega notas, cambia tags, asigna a otro operador. Fuera de horario de atención, auto-respuesta configurable.
**Actores**: Member, contacto, bot IA (opcional, BYO-key).

### 4.6. Cumplimiento Habeas Data
Un contacto o el Owner solicita exportación o borrado. El sistema genera JSON/CSV completo del contacto (o de toda la organización) o ejecuta borrado seguro. Opt-out vía `STOP` se procesa automáticamente y excluye al contacto de campañas futuras.
**Actores**: Owner, Admin, sistema, contacto.

### 4.7. Suscripción y cobro
Owner contrata plan (mensual o anual con 20% off) pagando vía Wompi. SuperAdmin monitorea suscripciones activas y, para Enterprise, configura precio y límites manualmente. **EduNet NO factura mensajes** — el cliente paga consumo de WhatsApp directamente a Meta desde su propia cuenta Cloud API.
**Actores**: Owner, SuperAdmin, Wompi, sistema.

---

## 5. Modelo de dominio (alto nivel)

**Identity & Tenancy**
- `User` — cuenta de persona; puede tener atributo global `super_admin`.
- `Organization` — único nivel de tenant; cuenta de billing y espacio operativo.
- `OrgMembership` — relación User × Organization × rol (owner/admin/member).
- `MemberPermission` — permiso explícito sobre feature para un membership con rol `member`.
- `Invitation` — invitación pendiente por correo.
- `ApiKey` — clave para webhook receiver / futura API pública.

**CRM**
- `Contact` — persona destinataria, único por (organization_id, phone E.164).
- `Tag` — etiqueta de organización.
- `ContactTag` — N:N entre contacto y tag.
- `Segment` — lista estática (selección) o dinámica (reglas) para campañas.
- `ImportJob` — proceso de importación CSV/XLSX con reporte de errores.
- `ConsentRecord` — opt-in/opt-out con fuente y timestamp.

**Messaging**
- `Channel` — número de WhatsApp asociado a organización con tipo de provider y credenciales BYO.
- `Template` — mensaje plantilla con variables, multimedia, estado de aprobación.
- `Conversation` — diálogo único por (organization, contact, channel).
- `Message` — mensaje individual rendered (no solo template_id + vars).
- `DeliveryEvent` — evento de entrega/lectura/falla.

**Campaigns & Scheduling**
- `Campaign` — broadcast con template snapshotted, segmento, schedule, estado.
- `CampaignRecipient` — tracking individual por destinatario.
- `ScheduledSend` — mensaje individual programado.
- `SendAttempt` — intento con reintento/backoff.

**Automation**
- `WebhookEndpoint` — endpoint público por organización con secreto y mapeo.
- `Trigger` — evento que arranca un flow.
- `Flow` — pipeline `Evento → Condiciones → Acciones[]`.
- `FlowRun` — instancia ejecutándose para un contacto, durable.
- `FlowStepResult` — resultado por paso de un FlowRun.

**Billing**
- `Plan` — Starter / Pro / Enterprise / Free, con dimensiones operativas (no mensajes).
- `Subscription` — suscripción de una organización a un plan, ligada a Wompi.
- `Invoice` — comprobante mensual/anual.
- `EnterpriseLimits` — override manual configurado por SuperAdmin para una organización.

**Operación**
- `AuditLog` — quién hizo qué, cuándo.

---

## 6. Capabilities propuestas

Cada capability candidata a ser una `spec` de OpenSpec. La granularidad final se decide en el `proposal`.

| Capability | Propósito | Justificación |
|-----------|-----------|---------------|
| **identity** | Registro, login (email+password, Google, magic link), sesiones, password reset. | Fundacional. Better-Auth + plugin Organizations cubre la base. |
| **tenancy** | Organizaciones, memberships, roles (owner/admin/member), permisos explícitos de member, invitaciones. SuperAdmin como atributo global. | Aislamiento multi-tenant es el riesgo #1 del negocio. |
| **billing** | Planes con dimensiones operativas, suscripciones vía Wompi, free trial, override Enterprise. SIN intermediación de mensajes. | Cobro simplificado de acceso a plataforma. |
| **contacts** | CRUD de contactos, normalización E.164, dedupe estricto por organización, custom fields (5 tipos), tags, segments. | Es el "CRM básico" pedido. Sin esto, las campañas no tienen audiencia. |
| **imports** | Importación CSV/XLSX con mapping, validación, dry-run y reporte de errores. | Origen de datos confirmado; calidad del dato bloquea operación. |
| **consent** | Opt-in con registro de fuente, opt-out automático (`STOP`), exclusión de campañas, exportación/borrado por solicitud. | Habeas Data es requisito legal no negociable. |
| **channels** | Conexión y gestión de canales WhatsApp BYO (Cloud API + WAHA/EvolutionAPI), wizard de onboarding, disclaimer no-oficial con timestamp, multi-canal por organización. | Hexagonal con `MessagingPort` desacoplando dominio del provider. |
| **templates** | Creación, aprobación, versionado, snapshot al lanzar campaña, validación pre-envío. | Restricción de Meta + protección contra cambios mid-campaign. |
| **campaigns** | Broadcast con segmento, programación, recipient tracking, rate limiting por canal, verificación de límites del plan. | Funcionalidad core demandada por el cliente. |
| **scheduling** | Mensajes y campañas programadas, cola durable con reintentos e idempotencia. | Trigger.dev v3 como motor — `wait` y reintentos nativos. |
| **automations** | Webhook receiver hardened, triggers, flows lineales con condiciones AND/OR, acciones cerradas, FlowRuns durables, composición flow→flow. | El "evento-condición-acción" pedido. Pipeline lineal evita complejidad de DAG. |
| **inbox** | Conversaciones bidireccionales, asignación, notas, horario de atención, auto-respuesta, bot vinculable con BYO-key OpenRouter y escalación a humano, notificaciones push. | Conversación es lo que diferencia "envío masivo" de "comunicación con clientes". |
| **analytics** | Reportes de envío, tasa de apertura, CTR, rendimiento por campaña, reportes SuperAdmin de uso de la plataforma y suscripciones. | Sin métricas no se pueden tomar decisiones de campaña ni gestionar el negocio. |
| **audit** | Audit log de acciones administrativas y operativas. | Compliance + soporte + debugging. |
| **admin** | Panel SuperAdmin de EduNet: cross-tenant, suspensión, métricas de negocio, configuración de Enterprise, alertas operativas. | EduNet necesita visibilidad operativa de su SaaS. |

> **Eliminado del MVP**: capability `outbound-webhooks` (diferida a post-MVP).

---

## 7. Requisitos no funcionales

- **Volumen de datos esperado**:
  - **Organizaciones (tenants): 100 al año 1** (objetivo cliente).
  - Contactos: 10.000 al inicio → 50.000 al año 1 (todas las organizaciones combinadas).
  - Mensajes: 10.000–100.000 al mes en total (procesados por la plataforma; NO facturados por EduNet).
- **Concurrencia esperada**: hasta 100 usuarios simultáneos en pico.
- **Disponibilidad requerida**: **99.5%** (~3.6 horas de downtime mensual permitido).
- **Dispositivos y navegadores**: web responsiva. Desktop (Chrome/Edge/Firefox/Safari modernos) y navegador móvil (iOS Safari, Android Chrome). Sin app nativa.
- **Idiomas**: Español (único en MVP). Arquitectura i18n-ready.
- **Performance crítica**:
  - Webhook receiver: respuesta 200 en < 500 ms (procesamiento asíncrono posterior).
  - Inbox realtime: latencia mensaje entrante → render < 2 s.
  - Envío masivo: respetar rate limit del provider (no es decisión, es restricción).
  - Importación CSV: 10.000 filas validadas en < 60 s (estimado, PENDIENTE benchmark real).

---

## 8. Seguridad y cumplimiento

- **Tipo de datos sensibles**: PII de contactos finales (teléfono, nombre, correo, empresa, cargo, país, campos personalizados), credenciales de canales WhatsApp (tokens Cloud API del cliente, sesiones WAHA), API keys de OpenRouter del cliente, historial de conversaciones, registros de consentimiento, datos de facturación.
- **Autenticación requerida**: email+password, Google OAuth, magic link. **MFA diferido a post-MVP.**
- **Niveles de autorización**: 4 roles (SuperAdmin global; Owner/Admin/Member por organización). Member sin permisos por defecto, asignados explícitamente por feature.
- **Auditoría / logs**: audit log de acciones administrativas y operativas con retención de 12 meses.
- **Regulaciones aplicables**: **Ley 1581 de Colombia (Habeas Data)** — derecho de acceso, rectificación, portabilidad y borrado; opt-out automático; registro de consentimiento. Reglas de la **WhatsApp Business API de Meta** — plantillas pre-aprobadas, ventana de 24h, opt-in explícito. **NO aplica GDPR** mientras no haya clientes en Europa.
- **Backups y retención**:
  - Mensajes: 6 meses.
  - Conversaciones cerradas, registros de consentimiento, audit log, métricas de campaña: 12 meses.
  - **Backups escalonados**: diarios con retención 30 días + semanales con retención 6 meses + mensuales con retención 18 meses.
  - Cifrado en reposo de columnas sensibles (incluyendo credenciales BYO de Cloud API y OpenRouter) y backups cifrados.
- **Webhook receiver**: HMAC + timestamp tolerance + replay protection (idempotency-key).
- **Aislamiento multi-tenant**: `organization_id` en TODA tabla, repository pattern que lo inyecta siempre, tests específicos de leak cero.

---

## 9. Integraciones

| Sistema externo | Propósito | Dirección |
|-----------------|-----------|-----------|
| **WhatsApp Cloud API (Meta)** | Envío y recepción oficial. Plantillas aprobadas, ventana 24h. **Cuenta y costo a cargo del cliente final (BYO).** | Bidireccional |
| **WAHA / EvolutionAPI** | Envío y recepción no-oficial (sesión QR). **Infra a cargo del cliente; disclaimer obligatorio.** | Bidireccional |
| **Pusher** | Realtime para Inbox (conversaciones en vivo). | Saliente desde backend, conexión cliente al servicio |
| **Trigger.dev v3** | Background jobs, scheduling, FlowRuns durables, realtime de tasks. | Saliente desde backend |
| **Cloudflare R2** | Storage de archivos multimedia de mensajes y plantillas. | Saliente desde backend |
| **Google OAuth** | Login. | Entrante (callback OAuth) |
| **OpenRouter** | Gateway de IA para bots del Inbox. **API key a cargo del cliente (BYO-key por bot).** | Saliente desde backend con key del cliente |
| **Wompi** | Cobro de suscripciones de la plataforma (única pasarela en MVP). | Bidireccional (webhooks de eventos de pago) |
| **Webhooks entrantes** (WordPress, Wix, Hotmart, Manychat, Meta Lead Ads, custom) | Recibir eventos para disparar automations. | Entrante |
| **Neon Postgres** | Base de datos relacional serverless. | Backend ↔ DB |

> **Diferidos a post-MVP**: Svix (webhooks salientes), Polar.sh y otras pasarelas.

---

## 10. Stack y arquitectura propuestos

**Aplicación web monolítica modular** (no microservicios) con backend y frontend en el mismo runtime, motor de jobs externo, y adapters hexagonales para los providers de WhatsApp y de pago.

- **Frontend + Backend**: Next.js 16 (App Router) + React + shadcn/ui (preset ya configurado).
- **Auth**: Better-Auth + plugin Organizations/Teams (validar T1 con context7).
- **ORM**: Drizzle.
- **Base de datos**: Postgres en Neon (serverless con branching).
- **Background jobs y FlowRuns**: Trigger.dev v3.
- **Realtime Inbox**: Pusher.
- **Storage de multimedia**: Cloudflare R2.
- **Mensajería WhatsApp**: hexagonal con `MessagingPort` + `CloudApiAdapter` + `WahaAdapter` (extensible).
- **Pasarela de pago**: hexagonal con `PaymentGatewayPort` + `WompiAdapter` (única en MVP, extensible).
- **Bot IA**: hexagonal con `AiGatewayPort` + `OpenRouterAdapter` (BYO-key por organización/bot).
- **Multi-tenant**: filtrado por repositorio con `organization_id` (no Postgres RLS en MVP).
- **Outbox pattern** para eventos que cruzan boundaries.
- **Despliegue**: VPS con Dokploy o Vercel. Dominio: `notify.edunet.com.co`.

Justificación: stack moderno fullstack TypeScript, una sola tecnología frontend/backend, escalable horizontal vía Vercel/PaaS, motor de jobs durable que cubre `wait` y reintentos sin escribir un scheduler propio. Arquitectura hexagonal en los tres puntos de extensión más probables (mensajería, pago, IA).

---

## 11. Supuestos clasificados

### ✅ CONFIRMADOS por el cliente

> Citados a `01-questions.md` salvo indicación contraria.

**Producto y mercado**
- SaaS multi-inquilino con organizaciones aisladas (1.1, 1.2).
- Mercado: Colombia + LATAM (Habeas Data sí, GDPR no) (6.2, 6.3).
- Plazo objetivo: 2 meses para primer prototipo funcional (10.2).
- Desarrollo en solitario, sin QA formal, con feedback de EduNet (10.3).
- **100 organizaciones objetivo al año 1** (12.1).

**Identidad y tenancy**
- 4 roles totales: SuperAdmin global, Owner, Admin, Member con permisos explícitos (2.3).
- Registro por invitación + self-service con plan free (2.4).
- Login con Google + magic link (2.5).
- **MFA diferido a post-MVP** (12.4).

**CRM**
- Datos mínimos de contacto + custom fields (3.1, 3.6).
- Tipos de custom fields: texto, número, fecha, dropdown, checkbox (11.4.1).
- Origen de contactos: importación CSV/XLSX + webhooks (3.2).
- Dedupe estricto por organización (3.4, 11.4.3).
- Aislamiento total entre organizaciones (3.5).

**Mensajería y campañas**
- Cloud API + WAHA/EvolutionAPI (7.1).
- **Cliente final aporta su propio número Cloud API verificado; EduNet no es BSP** (11.1.2).
- **Wizard tipo asistente para onboarding del canal Cloud API** (12.13).
- Disclaimer con timestamp para WAHA/EvolutionAPI (11.1.3).
- Campañas inmediatas y programadas; mensajes individuales programados (4.1, 4.2).
- Rate limiting respetando Cloud API y simulando control en WAHA/EvolutionAPI (4.2).
- HSM aprobadas + mensajes de sesión + validación previa para no-oficiales (4.5).
- Plantillas en un solo idioma por organización (11.7.5).
- Historial de mensajes 6 meses (3.3).

**Automations**
- Condiciones sobre datos del contacto + posibilidad de evaluación con LLM (4.3).
- Encadenamiento temporal y composición flow→flow; sin branching por resultado intermedio; sin variables compartidas (4.4, 11.3.x).

**Inbox**
- Bidireccional con bot opcional y escalación a humano (4.6).
- Notas, etiquetas, asignación a agente (4.7).
- 2–5 operadores por organización; sin menciones ni SLA timers en MVP; notificaciones push; horario de atención con auto-respuesta (11.2.x).
- **Bot IA con BYO-key OpenRouter por bot, modelo elegible** (12.10).

**Cumplimiento**
- Consentimiento previo registrado (6.1).
- Opt-out automático (6.4).
- Hosting fuera de Colombia permitido (6.5).
- Exportación JSON/CSV + borrado por solicitud desde día 1 (11.7.1).
- Retención: conversaciones, consentimiento, audit log, métricas de campaña 12 meses (11.7.2).
- **Backups escalonados: diario 30d / semanal 6m / mensual 18m** (12.3).
- **SLA 99.5%** (12.2).

**Billing y planes**
- Plan free 200 mensajes / 14 días, downgrade a solo lectura al agotarse (11.5.5).
- Mensual + anual con 20% off (11.5.2).
- **Modelo simplificado SIN intermediación de mensajes**: cliente paga acceso fijo a EduNet + paga consumo de Meta directamente con su cuenta Cloud API (12.6).
- **Plan Enterprise configurable manualmente por SuperAdmin** (precio, contactos, canales, operadores, automations, etc.) (12.7).
- **Wompi como única pasarela en MVP** (12.5).

**Integraciones**
- Webhooks de WordPress, Wix, Hotmart, Manychat, Meta Lead Ads + custom (7.2).
- Sin integración con CRMs externos en MVP (7.3).
- Pasarelas de pago solo para suscripciones (7.4).
- **Webhooks salientes diferidos a post-MVP** (12.9).
- **Sin API pública en MVP, arquitectura debe permitirla** (11.7.4).

**No funcional y stack**
- Volumen: 10.000–100.000 mensajes/mes; 10.000 contactos iniciales → 50.000 al año (5.1, 5.2).
- Web responsiva sin app nativa; pico 100 usuarios simultáneos (5.3, 5.4, 5.5).
- UI solo en Español en MVP, arquitectura i18n-ready (11.6.1).
- Despliegue Dokploy/Vercel; soporte multi-canal por organización (8.2, 8.3).
- **Dominio `notify.edunet.com.co`** (12.12).
- Stack Next.js fullstack (8.5).
- **Identidad visual: preset shadcn ya configurado, logo durante MVP** (12.8).
- **Validación T1–T4 con context7 antes de cerrar `proposal`** (12.14).

### 🟡 ASUMIDOS por mí (estándar del dominio)

- **Cifrado TLS en tránsito y cifrado en reposo de columnas sensibles** (teléfonos, tokens BYO de canales y OpenRouter). Estándar de seguridad básico no negociable.
- **Audit log inmutable append-only** retenido 12 meses (alineado con la retención del resto). Estándar para cumplimiento Habeas Data.
- **Política de contraseña**: mínimo 8 caracteres, sin reglas de complejidad agresivas. Recomendación NIST moderna; el resto se cubre con magic link y Google.
- **Rate limit del webhook receiver**: 100 req/s por endpoint. Defensa razonable contra abuso; ajustable por configuración.
- **Idempotency-key en webhook entrante con ventana de deduplicación de 24h.** Estándar de la industria para reprocesos.
- **Reportes con datos en tiempo casi real (lag aceptable < 1 minuto).** Suficiente para campañas de marketing; no es trading.
- **Localización en horario de Bogotá (UTC-5) por defecto, configurable por organización.** Mercado primario es Colombia.
- **Free trial NO requiere tarjeta de crédito.** Estándar de SaaS de marketing/comunicación para reducir fricción.
- **Modelo de planes propuesto** (validado con el cliente vía propuesta del ingeniero):

  | Dimensión | Starter $19 | Pro $39 | Enterprise (custom por SuperAdmin) |
  |-----------|-------------|---------|------------------------------------|
  | Contactos | 1.000 | 5.000 | Custom |
  | Canales WhatsApp | 1 | 3 | Custom |
  | Operadores | 2 | 5 | Custom |
  | Flows de automatización | 5 | 20 | Custom |
  | Retención de historial | 6 meses | 12 meses | Custom |
  | Bot IA habilitado | ❌ | ✅ | ✅ |
  | Soporte priorizado | ❌ | ❌ | ✅ |

  Reemplaza el modelo previo de "mensajes incluidos" (que perdió sentido al simplificar el cobro a fijo y BYO Cloud API).

### 🔴 PENDIENTES de confirmar

- **(ninguna mayor)** — Las 14 pendientes anteriores fueron resueltas en `01-questions.md` §12.
- **Tabla de planes propuesta** (en supuestos asumidos) — confirmada por el cliente en este flujo de trabajo; pendiente formalizar en `proposal`.
- **Benchmark real de importación CSV** (< 60 s para 10.000 filas) — se valida en implementación.

> **Nota sobre la contradicción del Plan Pro**: la "CONTRADICCIÓN detectada" en versiones previas de este documento (Plan Pro $39 con "10.000 mensajes incluidos" vs costo real Cloud API) **queda disuelta** al cambiar el modelo de cobro: EduNet ya no intermedia mensajes (12.6).

---

## 12. Riesgos identificados

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|--------|--------------|---------|------------|
| R1 | Baneo de números cliente final por mal uso de WAHA/EvolutionAPI | Alta | Crítico (pérdida del número del cliente, demanda al revendedor) | Disclaimer con timestamp obligatorio. Cloud API por defecto. UX educativa. Soft-limits de envío. |
| R2 | Bug filtra contactos entre organizaciones | Media | Catastrófico (fin del negocio, demandas) | `organization_id` en todas las tablas, repository pattern, tests de aislamiento, code review obligatorio en PRs que tocan repos. |
| R3 | Plantilla rechazada por Meta mid-campaign | Media | Alto (mitad de la campaña con plantilla vieja o detenida) | Snapshot del template al lanzar campaña. Estado visible en UI. |
| R4 | Cliente percibe poco valor si solo paga acceso a la plataforma sin paquete de mensajes | Media | Alto (baja conversión / churn) | Comunicación clara del modelo BYO ("vos pagás Meta directo, sin markup nuestro"). Wizard de onboarding documentado. Reportes que muestren ahorro vs intermediarios. |
| R5 | Trigger.dev Realtime inmaduro o caro a escala | Baja | Medio (tener que migrar runtime de tasks) | T2 — validar con context7. Aislar consumo de realtime detrás de un puerto interno, fácil de reemplazar. |
| R6 | Rate limits Cloud API más estrictos de lo previsto en pico de campañas | Media | Medio (mensajes salen mucho más tarde de lo programado) | Bucket por canal en scheduler, backoff exponencial, comunicación clara al usuario del SLA esperado. |
| R7 | Plazo de 2 meses para MVP es agresivo dado el alcance | Alta | Alto (deuda técnica o entrega parcial) | Priorizar épicas 4.1–4.3 y 4.6 para "MVP-core"; 4.4–4.5 y 4.7 como "MVP+1". Clarificar con cliente qué se puede diferir. |
| R8 | Webhook receiver sin verificación robusta → spam interno | Baja | Alto (campañas falsas, costos) | HMAC + timestamp + replay protection desde día 1. |
| R9 | Habeas Data exige procesos manuales no automatizados | Media | Medio (multas, procesos manuales no escalables) | Exportación y borrado en self-service desde día 1. SuperAdmin tiene visibilidad. |
| R10 | Bot de IA en Inbox responde mal y daña al cliente final | Media | Alto (reputación, churn) | Bot opt-in, prompt explícito, escalación humana clara, logs de conversaciones del bot. BYO-key garantiza que el cliente controla el costo. |
| R11 | Único desarrollador (sin QA formal) introduce regresiones | Media | Medio (entrega tarde, calidad inconsistente) | Tests automatizados desde día 1, especialmente de aislamiento multi-tenant y reglas de negocio críticas. CI obligatorio. |
| R12 | Identidad visual del cliente no llega a tiempo | Baja | Bajo (preset shadcn ya configurado; solo falta logo, integrable al final) | Empezar con shadcn neutral; integrar logo cuando esté disponible. |
| R13 | Cliente no completa la verificación de Cloud API con Meta | Media | Alto (sin canal Cloud API no hay envíos oficiales) | Wizard documentado; soporte de SuperAdmin durante onboarding; canal alternativo WAHA con disclaimer mientras Meta verifica. |

> **Eliminado**: R4 previo "Costos Cloud API mal contabilizados" — ya no aplica porque EduNet no intermedia mensajes.

---

## 13. Criterios de éxito (medibles)

1. **Tasa de entrega de mensajes ≥ 95%** sobre los enviados intencionalmente (excluyendo números inválidos y opt-outs). Métrica básica de salud del producto.
2. **Aislamiento multi-tenant validado**: 0 incidentes de leak cross-organization detectados en pruebas automáticas y revisiones manuales antes de lanzamiento.
3. **Cumplimiento Habeas Data verificable**: 100% de las solicitudes de exportación o borrado completadas en self-service en < 24 h sin intervención manual.
4. **Time-to-first-message del nuevo Owner**: desde signup hasta primer mensaje enviado de prueba en **< 30 minutos**, medido en onboarding analytics. Indicador de simplicidad de UX, criterio explícito del cliente (1.5).
5. **Adopción**: al menos **10 organizaciones activas pagas** dentro de los 3 meses posteriores al lanzamiento del MVP (objetivo intermedio hacia los 100 tenants año 1).
6. **Conversión free → paid ≥ 15%** durante los 14 días de prueba. Indicador clave del modelo BYO (los clientes deben percibir valor en la plataforma, no en el paquete de mensajes).

---

## Próximo paso

Pasar a `proposal` (recomendado: `notify-mvp-foundation`), donde se decide qué subset de las capabilities listadas en §6 entra al primer sprint y cuáles se difieren. Antes de cerrar el `proposal`, validar T1–T4 con `context7` (Better-Auth Organizations, Trigger.dev v3 Realtime, Drizzle adapter, Neon serverless bajo carga).

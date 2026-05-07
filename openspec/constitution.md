# Constitución del Proyecto: Notify

## 1. Misión

Notify es un SaaS multi-inquilino que permite a PyMEs latinoamericanas automatizar comunicación por WhatsApp combinando envíos masivos, automatizaciones evento-condición-acción, CRM básico e Inbox bidireccional. Lo construye y opera EduNet bajo modelo **BYO (Bring Your Own) Cloud API account**: el cliente conecta y paga su propia cuenta de Meta/WAHA, EduNet cobra solo el acceso a la plataforma. Mercado primario: Colombia y LATAM hispanohablante.

## 2. Principios no negociables

1. **Aislamiento multi-tenant absoluto**: toda tabla de dominio incluye `organization_id`; todo acceso pasa por un repository pattern que lo inyecta. Cero leak cross-organization es criterio de release. Tests de aislamiento son obligatorios en cualquier PR que toque repos.
2. **EduNet NO intermedia mensajería**: el costo de mensajes de WhatsApp lo paga el cliente directo a Meta/su infraestructura. La plataforma jamás factura mensajes, "paquetes incluidos" ni overage.
3. **Consentimiento auditable**: todo contacto tiene `ConsentRecord` con fuente y timestamp; opt-out (`STOP`) excluye automáticamente de campañas. Sin consent registrado, no hay envío.
4. **Habeas Data en self-service desde día 1**: exportación (JSON/CSV) y borrado por solicitud completados en < 24h sin intervención manual. Retención: mensajes 6 meses; conversaciones, consent, audit log y métricas 12 meses.
5. **Webhook receiver hardened**: HMAC + timestamp tolerance + replay protection (idempotency-key) en todos los endpoints públicos. Respuesta < 500ms p95; procesamiento asíncrono posterior.
6. **Snapshot de plantilla al lanzar campaña**: una campaña en vuelo nunca se ve afectada por edición o rechazo posterior del template.
7. **Audit log de toda mutación administrativa y operativa**: append-only, retención 12 meses, con usuario, organización, timestamp y diff.
8. **Cifrado en reposo de credenciales BYO**: tokens Cloud API, sesiones WAHA y API keys de OpenRouter del cliente se almacenan cifrados a nivel de columna. TLS obligatorio en tránsito.

## 3. Stack tecnológico (decidido)

- **Frontend + Backend**: Next.js 16 (App Router) + React + TypeScript + shadcn/ui
- **Auth**: Better-Auth + plugin Organizations (email+password, Google OAuth, magic link)
- **ORM**: Drizzle
- **Base de datos**: Postgres en Neon (serverless con branching)
- **Background jobs / FlowRuns**: Trigger.dev v3
- **Realtime (Inbox)**: Pusher
- **Storage multimedia**: Cloudflare R2
- **Pasarela de pago**: Wompi (única en MVP)
- **Hosting**: Vercel o VPS con Dokploy. Dominio: `notify.edunet.com.co`

## 4. Convenciones de código

- **Idioma del código**: inglés (identifiers, comments, commits). UI en español.
- **Arquitectura**: hexagonal en los tres puntos de extensión — `MessagingPort`, `PaymentGatewayPort`, `AiGatewayPort`. Dominio nunca importa adapters.
- **Estilo**: ESLint + Prettier con configuración del repo. CI bloquea si no pasa.
- **Tests obligatorios para**: aislamiento multi-tenant (siempre), reglas de negocio críticas (campañas, consent, billing, automation engine), webhook signature verification, adapters de mensajería con fixtures de Cloud API/WAHA.
- **Commits**: Conventional Commits. Sin atribución a IA.
- **Branching**: trunk-based; feature branches cortas mergeadas a `main` vía PR.
- **PRs**: review obligatorio en cualquier cambio que toque repos, auth, billing o adapters de provider. CI verde es no negociable.

## 5. Límites y restricciones

- **Nunca** seremos un BSP de WhatsApp ni revendedor de mensajes de Meta.
- **Nunca** se persiste un mensaje saliente sin verificar previamente los límites del plan de la organización.
- **Nunca** se expone un endpoint público sin HMAC + replay protection.
- **No hay app móvil nativa** en MVP ni en el roadmap declarado.
- **No hay API pública para clientes** en MVP (la arquitectura debe permitirla a futuro).
- **No hay Postgres RLS** en MVP — el aislamiento vive en el repository pattern.
- **No hay GDPR** mientras no haya clientes en Europa; Habeas Data CO es el régimen aplicable.
- **Sin integraciones nativas con CRMs externos** (HubSpot, Zoho, etc.) en MVP.

## 6. Decisiones arquitectónicas inmutables

1. **Organización es el único nivel de tenant**. No hay sub-tenants, equipos anidados ni workspaces dentro de la organización.
2. **Multi-provider de mensajería vía hexagonal con BYO credentials**: Cloud API y WAHA/EvolutionAPI conviven detrás de `MessagingPort`; las credenciales son del cliente y se almacenan cifradas.
3. **Automation engine lineal** (`Evento → Condiciones AND/OR → Acciones[]`) con acciones cerradas (`add_tag`, `remove_tag`, `update_contact_field`, `wait`, `http_request`, `send_message`) y composición flow→flow. Sin DAG, sin branching por resultado intermedio, sin variables compartidas entre acciones.
4. **Trigger.dev v3 es el motor durable** de FlowRuns, scheduling y reintentos. No se construye scheduler propio.
5. **Outbox pattern** para todo evento de dominio que cruce boundaries (mensajería, billing, webhooks).

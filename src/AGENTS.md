<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Constitution

Antes de escribir o modificar código en este proyecto, leé y respetá [openspec/constitution.md](../openspec/constitution.md). Es la fuente de verdad para:

- **Misión y modelo de negocio**: Notify es SaaS multi-tenant BYO Cloud API. EduNet NO intermedia mensajería ni factura mensajes.
- **Principios no negociables**: aislamiento multi-tenant via repository pattern (`organization_id` en toda tabla de dominio), consentimiento auditable, Habeas Data self-service, webhooks hardened (HMAC + replay protection), snapshot de plantilla al lanzar campaña, audit log append-only, cifrado en reposo de credenciales BYO.
- **Stack decidido**: Next.js 16 App Router + TS + shadcn/ui, Better-Auth (plugin Organizations), Drizzle, Postgres/Neon, Trigger.dev v3, Pusher, Cloudflare R2, Wompi.
- **Convenciones**: código en inglés, UI en español. Arquitectura hexagonal en `MessagingPort`, `PaymentGatewayPort`, `AiGatewayPort` — el dominio nunca importa adapters. Conventional Commits sin atribución a IA.
- **Tests obligatorios**: aislamiento multi-tenant siempre; reglas críticas de campañas, consent, billing, automation engine; verificación de firmas de webhooks; adapters con fixtures de Cloud API/WAHA.
- **Límites duros**: no Postgres RLS en MVP, no API pública para clientes en MVP, no app móvil, no integraciones nativas con CRMs externos, no GDPR (aplica Habeas Data CO).
- **Decisiones inmutables**: Organización es el único nivel de tenant. Automation engine lineal (Evento → Condiciones AND/OR → Acciones[]) — sin DAG. Trigger.dev v3 es el motor durable. Outbox pattern para eventos cross-boundary.

Si una instrucción del usuario contradice la constitución, pausá y señalá el conflicto antes de proceder.

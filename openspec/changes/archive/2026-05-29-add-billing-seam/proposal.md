## Why

Notify cobrará en 3 dimensiones (uso de mensajes, tiers por plan, y asiento por usuario), lo que hace que tanto "construir toda la facturación primero" (diseñar límites sobre features que aún no existen) como "transversalizar al final" (retro-instrumentar metering y enforcement en N features) sean caminos costosos y frágiles. Necesitamos una **costura de billing** estable —una abstracción que toda feature consuma desde su nacimiento— antes de construir las features de producto (Conexión WhatsApp, Envío, Automatizaciones). El **engine de cobro real (Stripe)** se difiere a un change posterior; lo que se establece ahora es el **contrato**, no el movimiento de dinero.

## What Changes

- **Nueva capa de servicios `billing`** en `web/lib/services/billing/` (módulos puros, sin `next/*` ni `hono`), con dos puertos de dominio:
  - `EntitlementsPort`: responde "¿puede este tenant hacer X?" resolviendo el **límite efectivo** = override por org `??` límite del plan, y aplicando **enforcement de topes duros**.
  - `UsagePort`: contrato para registrar consumo (`record(ctx, metric, qty)`). Se define la **interfaz** para que la feature de Envío (change futuro) la consuma; el registro/medición real nace con esa feature.
- **Catálogo de planes DB-backed y configurable** (Trial / Basic / Plus / Pro, **USD**), editable sin redeploy. Límites por plan: mensajes incluidos, números, usuarios, automatizaciones activas, agentes activos, features booleanas e ilimitados.
- **Asignación de plan por organización**: toda org nace en **Trial** automáticamente al crearse; existe exactamente un plan activo por org.
- **Override de límites por organización** (capa opcional sobre el plan, para casos negociados/enterprise). Se modela el affordance en el schema desde ya; la UI de edición puede venir después.
- **Enforcement de topes duros desde v0** sobre conteos (números, usuarios, automatizaciones/agentes **activos**), con la feature aportando el `current` y billing dueño del límite.
- **Taxonomía de 5 tipos de entitlement** como contrato: ① cupo medido + overage · ② tope por conteo + add-on · ③ tope duro · ④ booleana · ⑤ ilimitado/metadata.
- **Super-admin** gana la capacidad de cambiar el plan de una org y definir overrides de límite.
- **Fuera de alcance (diferido a `add-billing-engine`)**: integración con Stripe, cobro real, compra de planes/add-ons, overage de mensajes, reset de cupo por ciclo de facturación, facturas, y FX. El precio por mensaje/usuario adicional del catálogo se almacena como dato pero **no se cobra** en este change.

## Capabilities

### New Capabilities
- `billing`: catálogo de planes configurable, asignación de plan por org (Trial por defecto), override de límites por org, resolución de límite efectivo, contrato de entitlements (`EntitlementsPort`) con enforcement de topes duros, y contrato de uso (`UsagePort`). NO incluye pasarela de pago ni cobro.

### Modified Capabilities
- `super-admin`: nuevo requisito — un SuperAdmin puede consultar y cambiar el plan de cualquier organización y definir/limpiar overrides de límite por entitlement.
- `organizations`: nuevo requisito — el alta de miembros (invitar / agregar / aceptar invitación) pasa por autorización del entitlement `seats`; al exceder el límite del plan, la operación se rechaza.

## Impact

- **DB / migraciones** (`web/lib/db/schema.ts`): nuevas tablas — catálogo de planes y sus límites por entitlement key; asignación plan↔org (o columna en `organization`); override de límite por org; y la tabla/estructura del ledger de uso (definida ahora, poblada por la feature de Envío). Seed del catálogo Trial/Basic/Plus/Pro.
- **Servicios** (`web/lib/services/billing/`): ports, tipos, schemas (zod 3.x), resolución de límite efectivo y enforcement. `DomainErrors` para denegaciones (p. ej. `forbidden`/`conflict` cuando se excede un tope).
- **Context bridges**: `TenantServiceContext` expone el accessor de entitlements para que las features pregunten vía `ctx`.
- **Integración con `organizations`**: el alta de organización dispara la asignación de plan Trial (punto de integración, sin cambiar el contrato de `organizations`).
- **Super-admin UI**: ficha de organización en `/super-admin/organizations/[orgId]` para inspeccionar/cambiar plan y administrar overrides (entregada como slice encadenado dentro de este change).
- **Integración con `organizations`**: hooks de membresía de better-auth (`beforeCreateInvitation`, `beforeAddMember`, `beforeAcceptInvitation`) consumen la costura para enforzar `seats`.
- **Sin impacto** en transporte externo de pago: no se añade Stripe ni dependencias de facturación en este change.

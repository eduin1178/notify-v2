## Context

Notify es un SaaS multi-tenant donde el tenant es la `organization` ([web/lib/db/schema.ts](web/lib/db/schema.ts)). La arquitectura impone una separación estricta dominio/transporte: la lógica vive en `web/lib/services/<dominio>/` como módulos puros (prohibido importar `next/*`, `hono`, `@hono/*` o `web/app/**`), recibiendo todo por `ctx` (`ServiceContext` / `TenantServiceContext` en [web/lib/services/context.ts](web/lib/services/context.ts)).

El modelo de cobro objetivo es híbrido en 3 dimensiones (uso de mensajes + tiers + asiento) con planes Trial/Basic/Plus/Pro en USD. Construir todo billing ahora sería diseñar límites sobre features inexistentes; construirlo al final obligaría a retro-instrumentar metering y enforcement en cada feature. Este change establece la **costura** (contrato estable que toda feature consume) sin el engine de pago.

## Goals / Non-Goals

**Goals:**
- Definir `EntitlementsPort` y `UsagePort` como contrato de dominio que las features consumirán vía `ctx`, con dirección de dependencia features → billing (nunca billing → features).
- Catálogo de planes **DB-backed y configurable** (editable sin redeploy), con sus límites por entitlement.
- Asignación de exactamente un plan activo por org (Trial por defecto al crear la org).
- Capa de **override de límite por org** y función de **resolución de límite efectivo**.
- **Enforcement de topes duros** (conteos) desde v0, con la feature aportando el `current`.
- Dejar el modelo de datos preparado para el engine (estados, ciclo, ledger de uso) sin implementarlo.

**Non-Goals:**
- Integración con Stripe o cualquier pasarela; cobro real; emisión de facturas.
- Overage de mensajes, compra de planes/add-ons, reset de cupo por ciclo de facturación.
- Medición real de uso (el ledger se define ahora; lo puebla la feature de Envío).
- Multi-moneda / FX (USD only; los COP de la tabla son referencia interna, no entran al modelo).
- UI de auto-servicio para cambiar de plan (en v0 solo super-admin asigna/override).

## Decisions

### D1 — Ports & Adapters: las features dependen del puerto, no del módulo billing
`EntitlementsPort` y `UsagePort` son interfaces en `web/lib/services/billing/ports.ts`. Las features llaman `ctx.entitlements.authorize(...)` / `ctx.usage.record(...)`. El adapter concreto (resolución desde DB + enforcement) se inyecta al construir `ctx`.
**Por qué:** invierte la dependencia. Cuando llegue el engine (Stripe), se cambia el adapter sin tocar features. Alternativa descartada: que cada feature consulte tablas de billing directamente → acopla todo a billing y viola la regla de capas.

### D2 — Catálogo en DB, no constante tipada
Los planes y sus límites viven en tablas (`plan`, `plan_entitlement`). 
**Por qué:** el requisito explícito es que los topes sean **configurables** sin redeploy. Alternativa descartada: constante TS tipada → más simple pero requiere deploy para tunear un límite, incompatible con el requisito. Se incluye un **seed** idempotente del catálogo Trial/Basic/Plus/Pro.

### D3 — `kind` del entitlement en código; `value` en DB
Existe un **registro de entitlement keys** en código (`web/lib/services/billing/entitlements.ts`) que define qué keys existen y su **tipo** (la taxonomía de 5): `metered_quota`, `counted_cap`, `boolean`, `unlimited`, `metadata`. Los **valores** (límites por plan) viven en DB.
**Por qué:** el `kind` es estructural (cambia con código/features, debe ser type-safe); el `value` es configuración (debe ser editable). Mezclarlos (todo en DB) perdería seguridad de tipos en el enforcement; todo en código perdería la configurabilidad. Keys v0: `messages_quota`, `whatsapp_numbers`, `seats`, `active_automations`, `active_agents`, `notifications_email`, `notifications_whatsapp`, `mass_campaigns`, `support_email`, `support_whatsapp`, `contacts`, `sla_response_hours`.

### D4 — Modelo de límite flexible (key-value), no columnas fijas
`plan_entitlement(plan_id, key, int_value NULL, bool_value NULL)` y `organization_entitlement_override(organization_id, key, int_value NULL, bool_value NULL)`.
**Por qué:** agregar una nueva key (futura feature) no requiere migración de columnas. `int_value NULL` con `kind=unlimited` representa "sin límite"; `bool_value` cubre features booleanas. Alternativa descartada: una columna por límite en `plan` → migración por cada nuevo entitlement.

### D5 — La feature aporta `current`; billing es dueño del límite
Firma: `authorize(ctx, { key, current?, delta }) → EntitlementDecision`. Para `counted_cap` la feature pasa su conteo actual (p. ej. nº de números activos). Para `metered_quota` el `current` lo resuelve el propio billing desde el ledger de uso (no la feature).
**Por qué:** billing no puede consultar el schema de cada feature (rompería capas). La feature conoce su propio conteo; billing conoce el límite. Decisión: `EntitlementDecision = { allowed: true } | { allowed: false, reason, key, limit, current, upgradeHint? }`.

### D6 — Asignación de plan vía tabla `subscription`, no columna en `organization`
`subscription(id, organization_id UNIQUE, plan_id, status, assigned_at, current_period_start NULL, current_period_end NULL, provider NULL, provider_ref NULL)`.
**Por qué:** forward-compat con el engine (estados `trialing/active/past_due/canceled`, ciclo, referencia de Stripe) sin migración disruptiva. En v0 solo se usan `plan_id`, `status=trialing|active`, `assigned_at`. Alternativa descartada: `organization.plan_id` → habría que migrar a tabla cuando llegue el engine.

### D7 — Enforcement con `DomainError`
Las denegaciones por tope se lanzan con `DomainErrors.forbidden(...)` o `DomainErrors.conflict(...)` ([web/lib/services/errors.ts](web/lib/services/errors.ts)) e incluyen `key`, `limit`, `current`. El error handler global ya las traduce a HTTP.
**Por qué:** consistencia con la convención de errores de dominio existente; las features no inventan su propio manejo.

### D8 — `UsagePort` como interfaz con recorder no-op en v0
Se define `UsagePort.record(ctx, metric, qty)` y la tabla `usage_event`, pero el adapter v0 es **no-op** (o solo escribe el evento sin afectar enforcement de mensajes, que se difiere).
**Por qué:** que la feature de Envío (change ②) ya tenga el contrato disponible. El metering real (qué cuenta como mensaje, reset por ciclo) se define con esa feature.

### D9 — Precios almacenados, no cobrados
`plan.price_usd`, y precios de overage/add-on como columnas/keys de dato. En v0 se guardan pero **ningún flujo los cobra**.
**Por qué:** el catálogo es conocimiento de producto estable; tenerlo en datos facilita que el engine (③) solo "enchufe" el cobro.

## Risks / Trade-offs

- **Sobre-modelado para v0** (estados de subscription, ledger, overrides que aún no se editan por UI) → Mitigación: son estructuras vacías/mínimas; el costo de añadirlas ahora es bajo y evita migraciones disruptivas al llegar el engine. Se documenta qué está inactivo.
- **Key-value de límites pierde algo de type-safety en DB** → Mitigación: el registro de keys en código (D3) valida key+kind en tiempo de compilación; la DB solo guarda valores.
- **`current` aportado por la feature puede desincronizarse** (race conditions al activar/crear en paralelo) → Mitigación: el enforcement v0 es best-effort; el engine endurecerá con constraints/locks donde aplique. Se documenta como limitación conocida.
- **Trial sin expiración en v0** (no hay vencimiento ni downgrade automático) → Mitigación: aceptable sin engine; la expiración de Trial es responsabilidad del change ④.
- **Doble fuente potencial de "plan" si el engine usa metadata de better-auth** → Mitigación: `subscription` es la fuente única de verdad del plan; el engine se integra contra ella.

## Migration Plan

1. Migración Drizzle: tablas `plan`, `plan_entitlement`, `subscription`, `organization_entitlement_override`, `usage_event`.
2. Seed idempotente del catálogo Trial/Basic/Plus/Pro con sus límites (USD).
3. Backfill: crear `subscription` en estado Trial para organizaciones existentes sin plan.
4. Conectar el alta de organización para asignar Trial automáticamente.
5. Construir el adapter de `EntitlementsPort`/`UsagePort` y exponerlo en los bridges de `ctx` (`buildServiceContext` / `buildServerServiceContext`).
6. **Rollback:** las features de v0 aún no enforzan nada crítico; revertir = drop de tablas + retirar el accessor de `ctx`. Sin pérdida de datos de negocio (no hay cobros).

## Open Questions

- ¿El override por org se administra solo por super-admin en v0, o también se expone vía API REST tenant-scoped? (Propuesta: solo super-admin en v0; REST llega con el engine.) R/ Solo super-admin en v0, para minimizar superficie de cambio.
- ¿`seats` se valida contra `member` activos en el momento de invitar/aceptar, o también al reactivar miembros? (Se precisa al integrar con `organizations`; el contrato ya lo soporta vía `current`.) R/ Al invitar, aceptar o reactivar. Es decir que cualquier cambio que incremente el conteo de miembros activos debe pasar por autorización de `seats`.
- ¿`messages_quota` se mide por mensaje saliente, por conversación, o ambos? Se difiere deliberadamente a la feature de Envío (change ②). R/ Por mensajes, tanto salientes como entrantes. Suman todos

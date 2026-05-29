## 1. Modelo de datos y migraciones

- [x] 1.1 Añadir tablas a [web/lib/db/schema.ts](web/lib/db/schema.ts): `plan`, `plan_entitlement`, `subscription`, `organization_entitlement_override`, `usage_event` (según D4/D6 del design)
- [x] 1.2 Definir restricciones: `plan.key` único; `subscription.organization_id` único; FKs con `onDelete: cascade` hacia `organization`/`plan`
- [x] 1.3 Generar y revisar la migración Drizzle
- [x] 1.4 Registrar las nuevas tablas en el objeto `schema` exportado

## 2. Registro de entitlements (código)

- [x] 2.1 Crear `web/lib/services/billing/entitlements.ts` con el registro de keys y su `kind` (`metered_quota` | `counted_cap` | `boolean` | `unlimited` | `metadata`)
- [x] 2.2 Declarar las keys v0: `messages_quota`, `whatsapp_numbers`, `seats`, `active_automations`, `active_agents`, `notifications_email`, `notifications_whatsapp`, `mass_campaigns`, `support_email`, `support_whatsapp`, `contacts`, `sla_response_hours`
- [x] 2.3 Exportar tipos derivados (union de keys, mapa key→kind) para uso type-safe en el enforcement

## 3. Seed del catálogo

- [x] 3.1 Crear seed idempotente de los planes Trial/Basic/Plus/Pro con precio USD
- [x] 3.2 Sembrar los `plan_entitlement` por plan según la tabla de precios (mensajes incluidos 2k/25k/50k/100k, números 1/2/5/10, usuarios 1/3/5/10, automatizaciones 2/5/10/25, agentes 1/5/10/25, booleanos e ilimitados)
- [x] 3.3 Verificar idempotencia (re-ejecutar no duplica filas) — requiere DB en vivo (`pnpm db:seed`)

## 4. Capa de servicios `billing` (ports y resolución)

- [x] 4.1 Crear `web/lib/services/billing/ports.ts` con `EntitlementsPort` (`authorize`) y `UsagePort` (`record`) y los tipos `EntitlementDecision`
- [x] 4.2 Crear `web/lib/services/billing/schemas.ts` (zod 3.x) para inputs/outputs reutilizables
- [x] 4.3 Implementar resolución de plan vigente por org (lee `subscription`) como fuente única de verdad
- [x] 4.4 Implementar `effectiveLimit(ctx, key)` = override(org,key) ?? valor del plan
- [x] 4.5 Implementar `authorize`: enforcement de topes duros (`counted_cap` con `current`+`delta`), booleanos, ilimitados; denegar con `DomainErrors` incluyendo `key`/`limit`/`current`
- [x] 4.6 Implementar el recorder no-op de `UsagePort` (escribe `usage_event` sin afectar enforcement de cupos medidos)
- [x] 4.7 Verificar pureza: ningún import de `next/*`, `hono`, `@hono/*` ni `web/app/**`

## 5. Asignación de plan e integración con organizaciones

- [x] 5.1 Servicio `assignTrial(ctx, organizationId)` que crea la `subscription` Trial (estado `trialing`)
- [x] 5.2 Conectar el alta de organización para invocar la asignación de Trial automáticamente
- [x] 5.3 Backfill: crear `subscription` Trial para organizaciones existentes sin suscripción (código; ejecución vía `pnpm db:seed`)
- [x] 5.4 Servicios de gestión para super-admin: `setPlan(ctx, orgId, planKey)`, `setOverride(ctx, orgId, key, value)`, `clearOverride(ctx, orgId, key)` con verificación de rol SuperAdmin

## 6. Exposición vía `ctx` (bridges)

- [x] 6.1 Extender `TenantServiceContext` ([web/lib/services/context.ts](web/lib/services/context.ts)) para exponer `entitlements` y `usage`
- [x] 6.2 Cablear los puertos en `buildServiceContext`/`buildTenantServiceContext` ([web/lib/api/build-ctx.ts](web/lib/api/build-ctx.ts))
- [x] 6.3 Cablear los puertos en `buildServerServiceContext` ([web/lib/api/server-ctx.ts](web/lib/api/server-ctx.ts))

## 7. Enforcement de `seats` en `organizations`

- [x] 7.1 Helper de billing `seatDecision(db, orgId, delta)` que cuenta miembros y autoriza `seats` ([web/lib/services/billing/seats.ts](web/lib/services/billing/seats.ts))
- [x] 7.2 Cablear hooks de better-auth `beforeCreateInvitation`, `beforeAddMember`, `beforeAcceptInvitation` para lanzar `APIError` 403 al exceder asientos ([web/lib/auth/index.ts](web/lib/auth/index.ts))
- [x] 7.3 Modelo de asiento = fila en `member` (usuario suspendido sigue ocupando asiento); documentado en spec delta de `organizations`

## 8. UI de super-admin (slice encadenado)

- [x] 8.1 Ficha de organización `/super-admin/organizations/[orgId]`: plan vigente + límites efectivos por entitlement ([page.tsx](web/app/(app)/super-admin/organizations/[orgId]/page.tsx))
- [x] 8.2 Control para cambiar el plan (sin flujo de cobro) — selector + `setPlanAction`
- [x] 8.3 Controles para definir/limpiar overrides por entitlement key — editor por fila + `setOverrideAction`/`clearOverrideAction` ([org-billing-controls.tsx](web/components/super-admin/org-billing-controls.tsx))
- [x] 8.4 Acceso solo SuperAdmin (guard de layout + enforcement en servicios; `notFound()` sin revelar) + copy español neutro
- [x] 8.5 Enlace desde el listado de organizaciones a la ficha de detalle

## 9. Verificación

- [x] 9.1 `pnpm exec tsc --noEmit`, `pnpm lint` y `pnpm build` limpios en `web/`
- [x] 9.2 Aplicar migración (`pnpm db:migrate`) y seed (`pnpm db:seed`) en DB — ejecutado por el usuario
- [x] 9.3 Probar manualmente: org nueva nace en Trial; cambio de plan altera límites efectivos; override prevalece y su limpieza revierte
- [x] 9.4 Probar denegación de tope (exceder `seats` al invitar) y su traducción a 403
- [x] 9.5 Confirmar que superar mensajes incluidos NO bloquea ni cobra en v0

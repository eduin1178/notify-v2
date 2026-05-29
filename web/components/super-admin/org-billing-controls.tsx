"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  clearOverrideAction,
  setOverrideAction,
  setPlanAction,
  type BillingActionState,
} from "@/app/(app)/super-admin/organizations/[orgId]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  EffectiveEntitlementDtoT,
  OrgBillingDtoT,
  PlanDtoT,
} from "@/lib/services/billing/schemas";

const KEY_LABELS: Record<string, string> = {
  messages_quota: "Mensajes (cupo mensual)",
  whatsapp_numbers: "Números de WhatsApp",
  seats: "Usuarios (asientos)",
  active_automations: "Automatizaciones activas",
  active_agents: "Agentes activos",
  notifications_email: "Notificaciones por email",
  notifications_whatsapp: "Notificaciones por WhatsApp",
  mass_campaigns: "Campañas masivas",
  support_email: "Soporte por email",
  support_whatsapp: "Soporte por WhatsApp",
  contacts: "Contactos",
  sla_response_hours: "SLA de respuesta (horas)",
};

const KIND_LABELS: Record<string, string> = {
  metered_quota: "Cupo medido",
  counted_cap: "Tope por conteo",
  boolean: "Incluido/No",
  unlimited: "Ilimitado",
  metadata: "Informativo",
};

function selectClass() {
  return "h-9 w-full border border-border bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
}

export function OrgBillingControls({
  billing,
  plans,
}: {
  billing: OrgBillingDtoT;
  plans: PlanDtoT[];
}) {
  return (
    <div className="space-y-8">
      <PlanSelector billing={billing} plans={plans} />
      <EntitlementsTable
        organizationId={billing.organizationId}
        entitlements={billing.entitlements}
      />
    </div>
  );
}

function PlanSelector({
  billing,
  plans,
}: {
  billing: OrgBillingDtoT;
  plans: PlanDtoT[];
}) {
  const [state, action] = useActionState<BillingActionState, FormData>(setPlanAction, {});

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Plan
      </h2>
      <form action={action} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="organizationId" value={billing.organizationId} />
        <div className="space-y-1">
          <label htmlFor="planKey" className="text-xs text-muted-foreground">
            Plan asignado
          </label>
          <select
            id="planKey"
            name="planKey"
            defaultValue={billing.plan?.key ?? plans[0]?.key}
            className={`${selectClass()} min-w-[12rem]`}
          >
            {plans.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name} · ${p.priceUsd} USD
              </option>
            ))}
          </select>
        </div>
        <SubmitButton label="Cambiar plan" pendingLabel="Guardando..." />
        <Feedback state={state} okLabel="Plan actualizado." />
      </form>
      <p className="text-xs text-muted-foreground">
        Estado de la suscripción:{" "}
        <span className="text-foreground">{billing.status ?? "sin suscripción"}</span>. El
        cambio de plan no genera ningún cobro.
      </p>
    </section>
  );
}

function EntitlementsTable({
  organizationId,
  entitlements,
}: {
  organizationId: string;
  entitlements: EffectiveEntitlementDtoT[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Límites (entitlements)
      </h2>
      <div className="border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Capacidad</th>
              <th className="px-4 py-2 font-medium">Tipo</th>
              <th className="px-4 py-2 font-medium">Valor efectivo</th>
              <th className="px-4 py-2 font-medium">Origen</th>
              <th className="px-4 py-2 font-medium">Override</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entitlements.map((e) => (
              <EntitlementRow key={e.key} organizationId={organizationId} entitlement={e} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatValue(e: EffectiveEntitlementDtoT): string {
  if (e.kind === "boolean") return e.bool === true ? "Incluido" : "No incluido";
  if (e.kind === "unlimited") return "Ilimitado";
  if (e.int === null || e.int === undefined) {
    return e.kind === "metadata" ? "—" : "Ilimitado";
  }
  return e.int.toLocaleString("es");
}

function EntitlementRow({
  organizationId,
  entitlement: e,
}: {
  organizationId: string;
  entitlement: EffectiveEntitlementDtoT;
}) {
  const [setState, setAction] = useActionState<BillingActionState, FormData>(
    setOverrideAction,
    {},
  );
  const [clearState, clearAction] = useActionState<BillingActionState, FormData>(
    clearOverrideAction,
    {},
  );
  const error = setState.error ?? clearState.error ?? null;
  const editable = e.kind === "counted_cap" || e.kind === "metered_quota" || e.kind === "boolean";

  return (
    <tr>
      <td className="px-4 py-2 font-medium">{KEY_LABELS[e.key] ?? e.key}</td>
      <td className="px-4 py-2 text-xs text-muted-foreground">
        {KIND_LABELS[e.kind] ?? e.kind}
      </td>
      <td className="px-4 py-2">{formatValue(e)}</td>
      <td className="px-4 py-2">
        {e.overridden ? (
          <span className="border border-border bg-muted px-2 py-0.5 text-xs">Override</span>
        ) : (
          <span className="text-xs text-muted-foreground">Plan</span>
        )}
      </td>
      <td className="px-4 py-2">
        {editable ? (
          <div className="flex flex-wrap items-center gap-2">
            <form action={setAction} className="flex items-center gap-2">
              <input type="hidden" name="organizationId" value={organizationId} />
              <input type="hidden" name="key" value={e.key} />
              {e.kind === "boolean" ? (
                <>
                  <input type="hidden" name="valueType" value="bool" />
                  <select
                    name="value"
                    defaultValue={e.bool === true ? "true" : "false"}
                    className={`${selectClass()} w-36`}
                    aria-label={`Override de ${KEY_LABELS[e.key] ?? e.key}`}
                  >
                    <option value="true">Incluido</option>
                    <option value="false">No incluido</option>
                  </select>
                </>
              ) : (
                <>
                  <input type="hidden" name="valueType" value="int" />
                  <Input
                    name="value"
                    type="number"
                    min={0}
                    defaultValue={e.int ?? ""}
                    placeholder="Ilimitado"
                    className="h-9 w-32"
                    aria-label={`Override de ${KEY_LABELS[e.key] ?? e.key}`}
                  />
                </>
              )}
              <SubmitButton label="Guardar" pendingLabel="..." variant="outline" />
            </form>
            {e.overridden ? (
              <form action={clearAction}>
                <input type="hidden" name="organizationId" value={organizationId} />
                <input type="hidden" name="key" value={e.key} />
                <SubmitButton label="Limpiar" pendingLabel="..." variant="ghost" />
              </form>
            ) : null}
            {error ? (
              <span role="alert" className="text-xs text-destructive">
                {error}
              </span>
            ) : null}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Sin control</span>
        )}
      </td>
    </tr>
  );
}

function SubmitButton({
  label,
  pendingLabel,
  variant = "default",
}: {
  label: string;
  pendingLabel: string;
  variant?: "default" | "outline" | "ghost";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function Feedback({ state, okLabel }: { state: BillingActionState; okLabel: string }) {
  if (state.error) {
    return (
      <span role="alert" className="text-xs text-destructive">
        {state.error}
      </span>
    );
  }
  if (state.ok) {
    return <span className="text-xs text-muted-foreground">{okLabel}</span>;
  }
  return null;
}

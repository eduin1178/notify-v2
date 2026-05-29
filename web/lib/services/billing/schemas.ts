import { z } from "zod";

import { ENTITLEMENT_KEYS } from "@/lib/services/billing/entitlements";

const entitlementKeyEnum = z.enum(
  ENTITLEMENT_KEYS as [string, ...string[]],
);

export const PlanKeyEnum = z.enum(["trial", "basic", "plus", "pro"]);

export const PlanDto = z.object({
  key: PlanKeyEnum,
  name: z.string(),
  priceUsd: z.string(),
});

export const EffectiveEntitlementDto = z.object({
  key: entitlementKeyEnum,
  kind: z.enum(["metered_quota", "counted_cap", "boolean", "unlimited", "metadata"]),
  int: z.number().int().nullable(),
  bool: z.boolean().nullable(),
  /** true si el valor proviene de un override por org (no del plan). */
  overridden: z.boolean(),
});

export const OrgBillingDto = z.object({
  organizationId: z.string(),
  organizationName: z.string(),
  plan: PlanDto.nullable(),
  status: z.string().nullable(),
  entitlements: z.array(EffectiveEntitlementDto),
});

export const SetPlanInput = z.object({
  planKey: PlanKeyEnum,
});

export const SetOverrideInput = z
  .object({
    key: entitlementKeyEnum,
    int: z.number().int().nullable().optional(),
    bool: z.boolean().nullable().optional(),
  })
  .refine((v) => v.int !== undefined || v.bool !== undefined, {
    message: "Debes indicar un valor int o bool para el override.",
  });

export type PlanDtoT = z.infer<typeof PlanDto>;
export type EffectiveEntitlementDtoT = z.infer<typeof EffectiveEntitlementDto>;
export type OrgBillingDtoT = z.infer<typeof OrgBillingDto>;
export type SetPlanInputT = z.infer<typeof SetPlanInput>;
export type SetOverrideInputT = z.infer<typeof SetOverrideInput>;

"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrgRole } from "@/lib/auth/access";
import { db } from "@/lib/db/client";
import { warrantyPolicies } from "@/lib/db/schema";

export type PolicyState = { ok?: boolean; error?: string };

const Policy = z
  .object({
    name: z.string().trim().min(1, "Name the rule.").max(120),
    matchType: z.enum(["all", "product_id", "sku_prefix"]),
    matchValue: z.string().trim().max(80).optional(),
    durationMonths: z.coerce.number().int().min(1, "At least 1 month.").max(120),
    startBasis: z.enum(["ordered", "completed"]),
    coverageNotes: z.string().trim().max(500).optional(),
    priority: z.coerce.number().int().min(0).max(100).default(0),
  })
  .refine((p) => p.matchType === "all" || !!p.matchValue, { message: "Enter the SKU prefix or product ID to match.", path: ["matchValue"] });

/** Owner adds a store warranty rule. Rules only SUGGEST dates; staff still verify each claim. */
export async function createPolicy(_: PolicyState, form: FormData): Promise<PolicyState> {
  const { organizationId } = await requireOrgRole(["owner"]);
  const parsed = Policy.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db
    .insert(warrantyPolicies)
    .values({ organizationId, ...parsed.data, matchValue: parsed.data.matchType === "all" ? null : parsed.data.matchValue });
  revalidatePath("/dashboard/settings/warranty");
  return { ok: true };
}

/** Rules are switched off rather than deleted: past warranties keep pointing at them. */
export async function setPolicyActive(id: string, isActive: boolean) {
  const { organizationId } = await requireOrgRole(["owner"]);
  await db
    .update(warrantyPolicies)
    .set({ isActive })
    .where(and(eq(warrantyPolicies.id, id), eq(warrantyPolicies.organizationId, organizationId)));
  revalidatePath("/dashboard/settings/warranty");
  return { ok: true };
}

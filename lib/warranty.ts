/**
 * Warranty SUGGESTION from merchant policies. Spec §5: an order date never proves
 * eligibility, and the MVP must not make automatic warranty decisions, so this only
 * proposes dates; a staff member sets the verification status.
 */
export type Policy = {
  id: string;
  matchType: "all" | "product_id" | "sku_prefix";
  matchValue: string | null;
  durationMonths: number;
  startBasis: "ordered" | "completed";
  priority: number;
  isActive: boolean;
};

export function matchPolicy(policies: Policy[], item: { productId: number | null; sku: string | null }) {
  return (
    policies
      .filter((p) => p.isActive)
      .filter((p) => {
        if (p.matchType === "all") return true;
        if (p.matchType === "product_id") return item.productId != null && String(item.productId) === p.matchValue;
        return !!item.sku && !!p.matchValue && item.sku.toUpperCase().startsWith(p.matchValue.toUpperCase());
      })
      .sort((a, b) => b.priority - a.priority)[0] ?? null
  );
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Start = completion (delivery proxy) or order date; expiry = start + duration (calendar months). */
export function suggestWarranty(policy: Policy | null, order: { orderedAt: Date | null; completedAt: Date | null }) {
  if (!policy) return null;
  const start = (policy.startBasis === "completed" ? order.completedAt : order.orderedAt) ?? order.orderedAt;
  if (!start) return { policyId: policy.id, durationMonths: policy.durationMonths, startsAt: null, expiresAt: null };
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + policy.durationMonths, start.getUTCDate()));
  return { policyId: policy.id, durationMonths: policy.durationMonths, startsAt: isoDate(start), expiresAt: isoDate(end) };
}

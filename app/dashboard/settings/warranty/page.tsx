import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOrgRole } from "@/lib/auth/access";
import { db } from "@/lib/db/client";
import { warrantyPolicies } from "@/lib/db/schema";
import { PolicyForm, PolicyToggle } from "./client";

export const metadata: Metadata = { title: "Warranty rules" };

export default function WarrantyRulesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-3xl rounded-lg" />}>
      <Rules />
    </Suspense>
  );
}

function matchText(p: { matchType: string; matchValue: string | null }) {
  if (p.matchType === "all") return "Every product";
  return p.matchType === "sku_prefix" ? `SKUs starting with ${p.matchValue}` : `Product ID ${p.matchValue}`;
}

async function Rules() {
  const { organizationId, role } = await requireOrgRole(["owner", "support_agent", "dispatcher"]);
  const policies = await db
    .select()
    .from(warrantyPolicies)
    .where(eq(warrantyPolicies.organizationId, organizationId))
    .orderBy(desc(warrantyPolicies.priority));
  return (
    <div className="max-w-3xl space-y-8">
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Warranty rules</h2>
          <p className="text-muted-foreground">
            Used to suggest cover dates when orders arrive. The highest-priority matching rule wins. A person still verifies every claim.
          </p>
        </div>
        <ul className="divide-y panel rounded-xl">
          {policies.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className={p.isActive ? "font-medium" : "font-medium text-muted-foreground line-through"}>{p.name}</p>
                <p className="text-sm text-muted-foreground">
                  {matchText(p)}, {p.durationMonths} months from {p.startBasis === "completed" ? "delivery" : "order date"}, priority{" "}
                  {p.priority}
                </p>
                {p.coverageNotes && <p className="text-sm text-muted-foreground">{p.coverageNotes}</p>}
              </div>
              {role === "owner" && <PolicyToggle id={p.id} active={p.isActive} />}
            </li>
          ))}
          {!policies.length && (
            <li className="px-4 py-3 text-muted-foreground">No rules yet. Orders will arrive without a suggested warranty.</li>
          )}
        </ul>
      </section>
      {role === "owner" && <PolicyForm />}
    </div>
  );
}

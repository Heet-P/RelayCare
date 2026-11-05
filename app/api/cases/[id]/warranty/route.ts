import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireCaseAccess } from "@/lib/auth/access";
import { WarrantyDecision } from "@/lib/cases/handoff";
import { db } from "@/lib/db/client";
import { caseEvents, serviceCases, warranties } from "@/lib/db/schema";
import { handle } from "@/lib/http";

/**
 * POST /api/cases/:id/warranty — a staff member records the warranty decision (spec §5:
 * no automatic warranty decisions; the policy only suggests dates).
 */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/cases/[id]/warranty">) => {
  const { id } = await ctx.params;
  const { kase, actor } = await requireCaseAccess(id, ["owner", "support_agent"]);
  const d = WarrantyDecision.parse(await req.json());
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .insert(warranties)
      .values({ orderItemId: kase.orderItemId, verificationStatus: d.status, verifiedBy: actor.user.id, verifiedAt: now, notes: d.notes, startsAt: d.startsAt, expiresAt: d.expiresAt, source: "manual" })
      .onConflictDoUpdate({
        target: warranties.orderItemId,
        set: {
          verificationStatus: d.status,
          verifiedBy: actor.user.id,
          verifiedAt: now,
          notes: d.notes ?? null,
          ...(d.startsAt ? { startsAt: d.startsAt } : {}),
          ...(d.expiresAt ? { expiresAt: d.expiresAt } : {}),
        },
      });
    await tx.update(serviceCases).set({ warrantyStatus: d.status }).where(eq(serviceCases.id, kase.id));
    await tx.insert(caseEvents).values({
      caseId: kase.id,
      actorId: actor.user.id,
      eventType: "warranty_verified",
      metadata: { status: d.status, ...(d.notes ? { notes: d.notes } : {}) },
    });
  });
  return NextResponse.json({ warrantyStatus: d.status });
});

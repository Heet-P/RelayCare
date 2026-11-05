import { createHmac } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { customerStatus } from "@/lib/cases/customer-status";
import { decrypt, safeEqual } from "@/lib/crypto";
import { db } from "@/lib/db/client";
import { orders, serviceCases } from "@/lib/db/schema";
import { loadIntegration } from "@/lib/woocommerce/integration";

/**
 * GET /api/public/order-status?i&o&exp&sig — called server-to-server by the WordPress plugin
 * to show "Support" status on My Account › Orders. Signed with the integration's link secret:
 * sig = HMAC-SHA256(secret, "status|i|o|exp"). Returns only a case number and a status phrase.
 */
export async function GET(req: Request) {
  const p = Object.fromEntries(new URL(req.url).searchParams) as Record<string, string>;
  const integration = p.i ? await loadIntegration(p.i) : null;
  if (!integration || !/^\d+$/.test(p.o ?? "") || !/^\d+$/.test(p.exp ?? "") || Number(p.exp) * 1000 < Date.now()) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const expected = createHmac("sha256", decrypt(integration.linkSecretEncrypted)).update(`status|${p.i}|${p.o}|${p.exp}`).digest("hex");
  if (!p.sig || !safeEqual(expected, p.sig)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  const [row] = await db
    .select({ caseNumber: serviceCases.caseNumber, status: serviceCases.status })
    .from(serviceCases)
    .innerJoin(orders, eq(orders.id, serviceCases.orderId))
    .where(and(eq(orders.organizationId, integration.organizationId), eq(orders.wcOrderId, Number(p.o))))
    .orderBy(desc(serviceCases.createdAt))
    .limit(1);
  return NextResponse.json(row ? { caseNumber: row.caseNumber, status: customerStatus(row.status).headline } : { caseNumber: null }, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}

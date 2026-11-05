import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { loadIntegration } from "@/lib/woocommerce/integration";
import { verifySupportLink } from "@/lib/woocommerce/support-link";

/**
 * GET /support/start?i&o&e&exp&sig — landing point of the store's "Get Support" button.
 * Valid link → email-code sign-in (pre-filled) → report a problem for that order.
 * Invalid/expired link → plain sign-in. Never shows order data before the email is verified.
 */
export async function GET(req: Request) {
  const p = Object.fromEntries(new URL(req.url).searchParams) as Record<string, string>;
  const integration = p.i ? await loadIntegration(p.i) : null;
  const valid =
    integration && p.o && p.e && p.exp && p.sig && verifySupportLink(decrypt(integration.linkSecretEncrypted), { i: p.i, o: p.o, e: p.e, exp: p.exp, sig: p.sig });
  if (!valid) redirect("/verify");

  const [order] = /^\d+$/.test(p.o)
    ? await db
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.organizationId, integration.organizationId), eq(orders.wcOrderId, Number(p.o))))
    : [];
  const next = order ? `/support/new?order=${order.id}` : "/my-orders";

  const actor = await getActor();
  if (actor && actor.user.email.toLowerCase() === p.e.toLowerCase()) redirect(next);
  redirect(`/verify?email=${encodeURIComponent(p.e)}&next=${encodeURIComponent(next)}`);
}

import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { withRls } from "@/lib/db/rls";
import { customers, orderItems, orders, warranties } from "@/lib/db/schema";

/**
 * Orders visible to the signed-in user, newest first. Runs under RLS (staff see their
 * organisation's orders; customers only their own), on top of the page's role check.
 */
export async function listOrders(authUserId: string, limit = 100) {
  return withRls(authUserId, async (tx) => {
    const rows = await tx
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        wcStatus: orders.wcStatus,
        orderedAt: orders.orderedAt,
        total: orders.total,
        currency: orders.currency,
        customerName: customers.name,
        customerEmail: customers.email,
      })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .orderBy(desc(orders.orderedAt))
      .limit(limit);
    if (!rows.length) return [];

    const items = await tx
      .select({
        orderId: orderItems.orderId,
        name: orderItems.name,
        quantity: orderItems.quantity,
        serialNumber: orderItems.serialNumber,
        warrantyStatus: warranties.verificationStatus,
        warrantyExpiresAt: warranties.expiresAt,
      })
      .from(orderItems)
      .leftJoin(warranties, eq(warranties.orderItemId, orderItems.id))
      .where(inArray(orderItems.orderId, rows.map((r) => r.id)));

    return rows.map((r) => ({ ...r, items: items.filter((i) => i.orderId === r.id) }));
  });
}
export type OrderRow = Awaited<ReturnType<typeof listOrders>>[number];

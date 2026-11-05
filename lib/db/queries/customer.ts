import "server-only";
import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import { TERMINAL } from "@/lib/cases/state-machine";
import { withRls } from "@/lib/db/rls";
import { orderItems, orders, serviceCases, warranties } from "@/lib/db/schema";

/**
 * Customer portal reads. Everything runs under RLS as the signed-in user, so a customer can
 * only ever see orders and cases linked to their verified email (spec §3 permission rule).
 */
export async function listMyPurchases(authUserId: string) {
  return withRls(authUserId, async (tx) => {
    const myOrders = await tx
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        wcStatus: orders.wcStatus,
        orderedAt: orders.orderedAt,
        completedAt: orders.completedAt,
        total: orders.total,
        currency: orders.currency,
      })
      .from(orders)
      .orderBy(desc(orders.orderedAt));
    if (!myOrders.length) return [];

    const items = await tx
      .select({
        id: orderItems.id,
        orderId: orderItems.orderId,
        name: orderItems.name,
        quantity: orderItems.quantity,
        serialNumber: orderItems.serialNumber,
        warrantyStatus: warranties.verificationStatus,
        warrantyExpiresAt: warranties.expiresAt,
      })
      .from(orderItems)
      .leftJoin(warranties, eq(warranties.orderItemId, orderItems.id))
      .where(inArray(orderItems.orderId, myOrders.map((o) => o.id)));

    const openCases = await tx
      .select({ id: serviceCases.id, orderItemId: serviceCases.orderItemId, caseNumber: serviceCases.caseNumber, status: serviceCases.status })
      .from(serviceCases)
      .where(and(inArray(serviceCases.orderId, myOrders.map((o) => o.id)), notInArray(serviceCases.status, TERMINAL)));

    return myOrders.map((o) => ({
      ...o,
      items: items
        .filter((i) => i.orderId === o.id)
        .map((i) => ({ ...i, openCase: openCases.find((c) => c.orderItemId === i.id) ?? null })),
    }));
  });
}
export type Purchase = Awaited<ReturnType<typeof listMyPurchases>>[number];

export async function listMyCases(authUserId: string) {
  return withRls(authUserId, (tx) =>
    tx
      .select({
        id: serviceCases.id,
        caseNumber: serviceCases.caseNumber,
        title: serviceCases.title,
        status: serviceCases.status,
        createdAt: serviceCases.createdAt,
        updatedAt: serviceCases.updatedAt,
        productName: orderItems.name,
      })
      .from(serviceCases)
      .innerJoin(orderItems, eq(orderItems.id, serviceCases.orderItemId))
      .orderBy(desc(serviceCases.updatedAt)),
  );
}

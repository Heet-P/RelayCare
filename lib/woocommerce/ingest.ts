import "server-only";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers, orderItems, orders, users, warranties, warrantyPolicies } from "@/lib/db/schema";
import { matchPolicy, suggestWarranty } from "@/lib/warranty";
import type { NormalizedOrder } from "./normalize";

/**
 * Upsert one WooCommerce order into RelayCare (spec §8 event pipeline:
 * upsert customer → upsert order → upsert items). Idempotent and retry-safe:
 * - natural keys: (org, wc_customer_id | lower(email)), (org, wc_order_id), (order, wc_line_item_id)
 * - stale deliveries (older date_modified) never overwrite newer data
 * - warranty rows are created once and only refreshed while still unverified
 *   (never overrides a human decision)
 *
 * Returns the RelayCare order id, or null when the delivery was stale.
 */
export async function ingestOrder(organizationId: string, n: NormalizedOrder): Promise<string | null> {
  return db.transaction(async (tx) => {
    // ---- customer ---------------------------------------------------------------
    const findExisting = async () => {
      const byWcId = n.customer.wcCustomerId
        ? await tx
            .select({ id: customers.id })
            .from(customers)
            .where(and(eq(customers.organizationId, organizationId), eq(customers.wcCustomerId, n.customer.wcCustomerId)))
        : [];
      if (byWcId.length) return byWcId[0];
      const [byEmail] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.organizationId, organizationId), sql`lower(${customers.email}) = ${n.customer.email}`));
      return byEmail;
    };
    let existing = await findExisting();

    // A RelayCare user who already verified this email (OTP) owns this customer record.
    const [verifiedUser] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(sql`lower(${users.email}) = ${n.customer.email}`, isNotNull(users.authUserId)));

    const customerValues = {
      name: n.customer.name,
      email: n.customer.email,
      phone: n.customer.phone,
      address: n.customer.address,
      ...(n.customer.wcCustomerId ? { wcCustomerId: n.customer.wcCustomerId } : {}),
    };
    let inserted: (typeof customers.$inferSelect)[] = [];
    if (!existing) {
      try {
        // Savepoint: order.created and order.updated for a NEW customer often arrive together and
        // are processed concurrently. The loser of that race hits the unique key; recover by
        // re-reading the row the winner created instead of failing the job.
        inserted = await tx.transaction((sp) =>
          sp
            .insert(customers)
            .values({ organizationId, ...customerValues, ...(verifiedUser ? { userId: verifiedUser.id, verifiedAt: new Date() } : {}) })
            .returning(),
        );
      } catch (err) {
        if ((err as { cause?: { code?: string } }).cause?.code !== "23505") throw err;
        existing = await findExisting();
        if (!existing) throw err;
      }
    }
    const [customer] = existing
      ? await tx.update(customers).set(customerValues).where(eq(customers.id, existing.id)).returning()
      : inserted;
    if (!customer.userId && verifiedUser) {
      await tx.update(customers).set({ userId: verifiedUser.id, verifiedAt: new Date() }).where(eq(customers.id, customer.id));
    }

    // ---- order (stale-safe upsert) ----------------------------------------------
    const orderValues = {
      organizationId,
      customerId: customer.id,
      ...n.order,
      rawSnapshot: n.raw,
    };
    const [order] = await tx
      .insert(orders)
      .values(orderValues)
      .onConflictDoUpdate({
        target: [orders.organizationId, orders.wcOrderId],
        set: {
          customerId: sql`excluded.customer_id`,
          orderNumber: sql`excluded.order_number`,
          wcStatus: sql`excluded.wc_status`,
          orderedAt: sql`excluded.ordered_at`,
          completedAt: sql`excluded.completed_at`,
          wcDateModified: sql`excluded.wc_date_modified`,
          total: sql`excluded.total`,
          currency: sql`excluded.currency`,
          shippingAddress: sql`excluded.shipping_address`,
          rawSnapshot: sql`excluded.raw_snapshot`,
        },
        setWhere: sql`${orders.wcDateModified} is null or excluded.wc_date_modified is null or excluded.wc_date_modified >= ${orders.wcDateModified}`,
      })
      .returning({ id: orders.id });
    if (!order) return null; // stale delivery: a newer version is already stored

    // ---- items + warranty suggestion ------------------------------------------------
    const policies = await tx.select().from(warrantyPolicies).where(eq(warrantyPolicies.organizationId, organizationId));

    for (const item of n.items) {
      const [row] = await tx
        .insert(orderItems)
        .values({ orderId: order.id, ...item })
        .onConflictDoUpdate({
          target: [orderItems.orderId, orderItems.wcLineItemId],
          set: {
            productId: sql`excluded.product_id`,
            variationId: sql`excluded.variation_id`,
            name: sql`excluded.name`,
            sku: sql`excluded.sku`,
            quantity: sql`excluded.quantity`,
            snapshot: sql`excluded.snapshot`,
            // Keep a serial captured elsewhere (customer / technician) if the store has none.
            serialNumber: sql`coalesce(excluded.serial_number, ${orderItems.serialNumber})`,
          },
        })
        .returning({ id: orderItems.id });

      const suggestion = suggestWarranty(matchPolicy(policies, item), n.order);
      if (suggestion) {
        await tx
          .insert(warranties)
          .values({ orderItemId: row.id, ...suggestion, source: "policy" })
          .onConflictDoUpdate({
            target: warranties.orderItemId,
            set: {
              policyId: suggestion.policyId,
              durationMonths: suggestion.durationMonths,
              startsAt: suggestion.startsAt,
              expiresAt: suggestion.expiresAt,
            },
            setWhere: sql`${warranties.verificationStatus} = 'unverified'`,
          });
      }
    }
    return order.id;
  });
}

import { z } from "zod";
import type { Address } from "@/lib/db/schema";

/**
 * Validate and normalise a WooCommerce REST v3 / webhook order payload.
 * Webhook bodies are untrusted input even after the signature check, so everything we
 * read is validated here; unknown fields are kept only in raw snapshots.
 */
const Addr = z
  .object({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    address_1: z.string().optional(),
    address_2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postcode: z.string().optional(),
    country: z.string().optional(),
  })
  .partial();

const Meta = z.object({ key: z.string(), value: z.unknown() });

export const WooOrder = z.object({
  id: z.number().int().positive(),
  number: z.union([z.string(), z.number()]).transform(String),
  status: z.string(),
  currency: z.string().length(3),
  total: z.string(),
  customer_id: z.number().int().nonnegative(),
  date_created_gmt: z.string().nullable(),
  date_modified_gmt: z.string().nullable(),
  date_completed_gmt: z.string().nullable().optional(),
  billing: Addr,
  shipping: Addr,
  line_items: z.array(
    z.object({
      id: z.number().int().positive(),
      name: z.string(),
      product_id: z.number().int().nullable().optional(),
      variation_id: z.number().int().nullable().optional(),
      sku: z.string().nullable().optional(),
      quantity: z.number().int(),
      meta_data: z.array(Meta).default([]),
    }),
  ),
});
export type WooOrder = z.infer<typeof WooOrder>;

/** Woo "*_gmt" timestamps have no zone suffix. */
const gmt = (s: string | null | undefined) => (s ? new Date(s.endsWith("Z") ? s : `${s}Z`) : null);

const toAddress = (a: z.infer<typeof Addr>): Address => ({
  line1: a.address_1 || undefined,
  line2: a.address_2 || undefined,
  city: a.city || undefined,
  state: a.state || undefined,
  postcode: a.postcode || undefined,
  country: a.country || undefined,
  phone: a.phone || undefined,
});

export function normalizeOrder(input: unknown, serialMetaKeys: string[]) {
  const o = WooOrder.parse(input);
  const email = o.billing.email?.trim().toLowerCase();
  if (!email) throw new Error(`Order ${o.id} has no billing email; cannot identify the customer`);
  const name = [o.billing.first_name, o.billing.last_name].filter(Boolean).join(" ") || email;
  const shipping = o.shipping.address_1 ? o.shipping : o.billing;

  return {
    customer: {
      wcCustomerId: o.customer_id > 0 ? o.customer_id : null, // 0 = guest checkout
      name,
      email,
      phone: o.billing.phone || null,
      address: toAddress(o.billing),
    },
    order: {
      wcOrderId: o.id,
      orderNumber: o.number,
      wcStatus: o.status,
      orderedAt: gmt(o.date_created_gmt),
      completedAt: gmt(o.date_completed_gmt),
      wcDateModified: gmt(o.date_modified_gmt),
      total: o.total,
      currency: o.currency,
      shippingAddress: { ...toAddress(shipping), phone: shipping.phone || o.billing.phone || undefined },
    },
    items: o.line_items.map((li) => {
      // Serial numbers are not a standard line-item field (spec §5): read configured meta keys.
      const serial = li.meta_data.find((m) => serialMetaKeys.includes(m.key) && typeof m.value === "string" && m.value.trim());
      return {
        wcLineItemId: li.id,
        productId: li.product_id || null,
        variationId: li.variation_id || null,
        name: li.name,
        sku: li.sku || null,
        quantity: li.quantity,
        serialNumber: serial ? String(serial.value).trim() : null,
        snapshot: li,
      };
    }),
    raw: input as Record<string, unknown>,
  };
}
export type NormalizedOrder = ReturnType<typeof normalizeOrder>;

import { z } from "zod";

/** POST /api/integrations/woocommerce/connect */
export const ConnectWooInput = z.object({
  storeUrl: z
    .url()
    .transform((u) => u.replace(/\/+$/, ""))
    .refine((u) => u.startsWith("https://") || process.env.NODE_ENV !== "production", "Store URL must use HTTPS"),
  consumerKey: z.string().regex(/^ck_[a-f0-9]{40}$/, "Consumer key looks like ck_ followed by 40 hex characters"),
  consumerSecret: z.string().regex(/^cs_[a-f0-9]{40}$/, "Consumer secret looks like cs_ followed by 40 hex characters"),
});
export type ConnectWooInput = z.infer<typeof ConnectWooInput>;

export type ConnectWooResult = {
  integrationId: string;
  /** "auto": RelayCare registered the webhooks. "manual": read-only key, follow `manual`. */
  webhooks: "auto" | "manual";
  deliveryUrl: string;
  /** Only returned for manual setup (paste into WooCommerce > Settings > Advanced > Webhooks). */
  webhookSecret?: string;
};

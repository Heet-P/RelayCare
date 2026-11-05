import "server-only";
import { syncCaseGroup } from "@/lib/nexconn/group-sync";
import { importOrders, processInbox } from "@/lib/woocommerce/jobs";

/** Job type → handler. Handlers MUST be idempotent: a job can run more than once. */
export const handlers: Record<string, (payload: Record<string, unknown>) => Promise<void>> = {
  "wc.order.process": processInbox,
  "wc.import": importOrders,
  "nexconn.group.sync": syncCaseGroup,
};

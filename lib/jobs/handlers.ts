import "server-only";
import { processNexconnEvent } from "@/lib/nexconn/events";
import { syncCaseGroup } from "@/lib/nexconn/group-sync";
import { geocodeCase } from "@/lib/geocode";
import { notifyCase } from "@/lib/notify";
import { importOrders, processInbox } from "@/lib/woocommerce/jobs";

/** Job type → handler. Handlers MUST be idempotent: a job can run more than once. */
export const handlers: Record<string, (payload: Record<string, unknown>) => Promise<void>> = {
  "wc.order.process": processInbox,
  "wc.import": importOrders,
  "nexconn.group.sync": syncCaseGroup,
  "case.notify": notifyCase,
  "nexconn.event": processNexconnEvent,
  "case.geocode": geocodeCase,
};

import "server-only";
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { chatThreads, nexconnEvents } from "@/lib/db/schema";

type Item = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : null);
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" ? [v] : []);

/**
 * Job `nexconn.event`: record conversation activity for the Conversations screen.
 * Deliberately does NOT touch case status (spec §12: a chat message is communication; a case
 * transition is an authorised business operation).
 */
export async function processNexconnEvent({ eventId }: Record<string, unknown>) {
  const [ev] = await db.select().from(nexconnEvents).where(eq(nexconnEvents.id, String(eventId)));
  if (!ev || ev.processedAt) return;
  const payload = ev.payload as { type: string; time?: number; data?: Item[] };
  const at = new Date(typeof payload.time === "number" ? payload.time : Date.now());

  if (payload.type.startsWith("message:")) {
    for (const item of payload.data ?? []) {
      const from = str(item.fromUserId) ?? str(item.senderUserId);
      const groups = [...list(item.toChannelIds), ...list(item.channelId), ...list(item.groupId)];
      const targets = [...list(item.toUserIds), ...list(item.targetId)];
      if (groups.length) {
        await db.update(chatThreads).set({ lastMessageAt: at }).where(inArray(chatThreads.nexconnGroupId, groups));
      }
      if (from && targets.length) {
        await db
          .update(chatThreads)
          .set({ lastMessageAt: at })
          .where(
            and(
              eq(chatThreads.threadType, "direct"),
              or(
                and(eq(chatThreads.customerNexconnId, from), inArray(chatThreads.agentNexconnId, targets)),
                and(eq(chatThreads.agentNexconnId, from), inArray(chatThreads.customerNexconnId, targets)),
              ),
            ),
          );
      }
    }
  }
  await db.update(nexconnEvents).set({ processedAt: new Date(), error: null }).where(eq(nexconnEvents.id, ev.id));
}

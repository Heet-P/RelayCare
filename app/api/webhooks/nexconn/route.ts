import { after, NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { db } from "@/lib/db/client";
import { nexconnEvents } from "@/lib/db/schema";
import { enqueue } from "@/lib/jobs/queue";
import { runJobs } from "@/lib/jobs/worker";
import { verifyNexconnWebhook } from "@/lib/nexconn/signature";

/**
 * POST /api/webhooks/nexconn — message and group events (configured in Nexconn Console ›
 * Chat settings). Verify SHA1(AppSecret+Nonce+Timestamp) → dedupe by event id → store → 2xx
 * quickly (Nexconn times out after 5 s). Processing never changes case status.
 */
export async function POST(req: Request) {
  const secret = process.env.NEXCONN_APP_SECRET ?? "";
  const h = req.headers;
  const appKey = h.get("appkey") ?? h.get("app-key");
  if (!appKey || !safeEqual(appKey, process.env.NEXT_PUBLIC_NEXCONN_APP_KEY ?? "")) {
    return NextResponse.json({ error: "Unknown app" }, { status: 401 });
  }
  if (!verifyNexconnWebhook(secret, { nonce: h.get("nonce"), timestamp: h.get("timestamp"), signature: h.get("signature") })) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { type?: unknown; id?: unknown };
  try {
    event = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "Body is not JSON" }, { status: 400 });
  }
  if (typeof event.id !== "string" || typeof event.type !== "string") return NextResponse.json({ error: "Missing id or type" }, { status: 400 });

  const inserted = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(nexconnEvents)
      .values({ id: event.id as string, type: event.type as string, payload: event })
      .onConflictDoNothing({ target: nexconnEvents.id })
      .returning({ id: nexconnEvents.id });
    if (row) await enqueue("nexconn.event", { eventId: row.id }, { tx, dedupeKey: `nexconn.event:${row.id}` });
    return row;
  });
  if (inserted) after(() => runJobs({ budgetMs: 4_000 }).catch((e) => console.error("[jobs] after()", e)));
  return NextResponse.json({ ok: true, duplicate: !inserted });
}

import { NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/session";
import { handle } from "@/lib/http";
import { ensureNexconnId } from "@/lib/nexconn/ids";
import { issueAccessToken } from "@/lib/nexconn/server";

/**
 * POST /api/chat/token — spec §9 auth flow:
 * client → RelayCare backend (verify identity) → Nexconn Server API issues token → client connects.
 * The App Secret stays here; the browser only ever sees its own user token.
 */
export const POST = handle(async () => {
  const actor = await requireActor();
  const nexconnUserId = await ensureNexconnId(actor.user.id);
  const token = await issueAccessToken({ userId: nexconnUserId, name: actor.user.name });
  return NextResponse.json(
    { token, userId: nexconnUserId, locale: actor.user.locale },
    { headers: { "Cache-Control": "no-store" } },
  );
});

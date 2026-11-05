import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, notFound } from "@/lib/http";
import { addGroupMembers, createGroupChannel, issueAccessToken, sendGroupText } from "@/lib/nexconn/server";

/**
 * DEV-ONLY Nexconn proof of concept (plan Phase 1). Issues tokens for four fixed demo
 * personas without a login so the communication layer can be verified before anything else.
 * Returns 404 in production.
 */
export const PERSONAS = {
  customer: { userId: "rcudevcustomer", name: "Demo Customer", locale: "gu" },
  maya: { userId: "rcudevmaya", name: "Maya (Support)", locale: "en" },
  arjun: { userId: "rcudevarjun", name: "Arjun (Dispatch)", locale: "en" },
  ravi: { userId: "rcudevravi", name: "Ravi (Technician)", locale: "hi" },
} as const;

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("token"), as: z.enum(["customer", "maya", "arjun", "ravi"]) }),
  z.object({ action: z.literal("create-group"), groupId: z.string().regex(/^[a-zA-Z0-9]{1,64}$/) }),
  z.object({ action: z.literal("add-ravi"), groupId: z.string().regex(/^[a-zA-Z0-9]{1,64}$/) }),
]);

export const POST = handle(async (req: Request) => {
  if (process.env.NODE_ENV === "production") throw notFound();
  const body = Body.parse(await req.json());

  switch (body.action) {
    case "token": {
      const p = PERSONAS[body.as];
      const token = await issueAccessToken({ userId: p.userId, name: p.name });
      return NextResponse.json({ token, locale: p.locale });
    }
    case "create-group": {
      await createGroupChannel({
        channelId: body.groupId,
        name: "RelayCare PoC group",
        owner: PERSONAS.arjun.userId,
        userIds: [PERSONAS.customer.userId, PERSONAS.maya.userId],
        introduction: "Nexconn proof of concept",
      });
      await sendGroupText(PERSONAS.arjun.userId, body.groupId, "Group created by the RelayCare backend.");
      return NextResponse.json({ ok: true });
    }
    case "add-ravi": {
      await addGroupMembers(body.groupId, [PERSONAS.ravi.userId]);
      await sendGroupText(PERSONAS.arjun.userId, body.groupId, "Technician Ravi has joined the conversation.");
      return NextResponse.json({ ok: true });
    }
  }
});

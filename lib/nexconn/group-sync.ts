import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { HandoffV1 } from "@/lib/cases/handoff";
import { db } from "@/lib/db/client";
import { caseAssignments, caseHandoffs, caseParticipants, chatThreads, serviceCases, users } from "@/lib/db/schema";
import { ensureNexconnId, groupChannelId } from "./ids";
import { addGroupMembers, createGroupChannel, issueAccessToken, NexconnError, removeGroupMembers, sendGroupText } from "./server";

/**
 * Job `nexconn.group.sync` — make the case's Nexconn group match RelayCare's participants
 * (spec §9 "Handoff implementation"). Idempotent: safe to retry after partial failure.
 * RelayCare's case_participants table is the source of truth; Nexconn mirrors it.
 */
export async function syncCaseGroup({ caseId, assignmentId }: Record<string, unknown>) {
  const [kase] = await db.select().from(serviceCases).where(eq(serviceCases.id, String(caseId)));
  if (!kase) return;

  const people = await db
    .select({ userId: users.id, name: users.name, role: caseParticipants.participantRole, removedAt: caseParticipants.removedAt })
    .from(caseParticipants)
    .innerJoin(users, eq(users.id, caseParticipants.userId))
    .where(eq(caseParticipants.caseId, kase.id));

  const ids = new Map<string, string>();
  for (const p of people) ids.set(p.userId, await ensureNexconnId(p.userId));
  const active = people.filter((p) => !p.removedAt);
  // Registering (issuing a token) creates/refreshes each Nexconn user before group membership.
  for (const p of active) await issueAccessToken({ userId: ids.get(p.userId)!, name: p.name });

  const owner = active.find((p) => p.role === "dispatcher") ?? active.find((p) => p.role === "owner") ?? active.find((p) => p.role === "support_agent");
  if (!owner) throw new Error(`Case ${kase.caseNumber} has no staff participant to own the group`);
  const channelId = groupChannelId(kase.caseNumber);
  const members = active.filter((p) => p !== owner).map((p) => ids.get(p.userId)!);

  const [thread] = await db
    .select()
    .from(chatThreads)
    .where(and(eq(chatThreads.caseId, kase.id), eq(chatThreads.threadType, "group")));
  if (!thread) {
    try {
      await createGroupChannel({
        channelId,
        name: `RelayCare ${kase.caseNumber}`,
        owner: ids.get(owner.userId)!,
        userIds: members,
        introduction: `Service conversation for ${kase.caseNumber}`,
      });
    } catch (err) {
      // Created on a previous attempt that failed later: fall through to membership sync.
      if (!(err instanceof NexconnError)) throw err;
    }
    await db
      .insert(chatThreads)
      .values({ caseId: kase.id, threadType: "group", nexconnGroupId: channelId })
      .onConflictDoNothing();
  }
  const create = () =>
    createGroupChannel({
      channelId,
      name: `RelayCare ${kase.caseNumber}`,
      owner: ids.get(owner.userId)!,
      userIds: members,
      introduction: `Service conversation for ${kase.caseNumber}`,
    });
  try {
    await addGroupMembers(channelId, [ids.get(owner.userId)!, ...members]);
  } catch (err) {
    // 25410 "Group channel ID does not exist": the group was dismissed (demo reset, clean-up)
    // while RelayCare still has its thread. Recreate it rather than failing forever.
    if (!(err instanceof NexconnError) || err.code !== 25410) throw err;
    await create();
  }
  const removed = people.filter((p) => p.removedAt && !active.some((a) => a.userId === p.userId)).map((p) => ids.get(p.userId)!);
  await removeGroupMembers(channelId, removed);

  // Spec §9 step 6: tell everyone the technician joined, with the structured context.
  if (assignmentId) {
    const [a] = await db
      .select({ technician: users.name, status: caseAssignments.assignmentStatus })
      .from(caseAssignments)
      .innerJoin(users, eq(users.id, caseAssignments.technicianId))
      .where(eq(caseAssignments.id, String(assignmentId)));
    if (a && a.status !== "cancelled") {
      const [h] = await db.select().from(caseHandoffs).where(eq(caseHandoffs.caseId, kase.id)).orderBy(desc(caseHandoffs.createdAt)).limit(1);
      const snap = h ? HandoffV1.safeParse(h.contextSnapshot) : null;
      const summary = snap?.success
        ? `\nIssue: ${snap.data.issue}. ${snap.data.symptoms.join("; ")}.\nRequired action: ${snap.data.actionRequired}`
        : "";
      await sendGroupText(
        ids.get(owner.userId)!,
        channelId,
        `Technician ${a.technician} has joined this case and has the full case history.${summary}`,
        { kind: "system", event: "technician_joined" },
      );
    }
  }
}

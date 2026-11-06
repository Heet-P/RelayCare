import type { ChatChannel } from "@/components/chat/chat-panel";
import type { CaseView } from "@/lib/db/queries/case-view";
import type { ActorRole } from "./state-machine";

/**
 * Which Nexconn channels a viewer may open for a case, decided on the server from the case
 * record (never from a channel id the browser supplies). Direct chats are 1:1, so only the
 * customer and the assigned agent can open them; the group is for every active participant.
 */
/** A minute of slack so a message sent while the case was being created still shows. */
const since = (view: CaseView) => new Date(view.case.createdAt).getTime() - 60_000;

export function chatChannelsFor(view: CaseView, role: ActorRole, viewerUserId: string) {
  const channels: ChatChannel[] = [];
  const direct = view.threads.find((t) => t.threadType === "direct" && t.isActive);
  if (direct) {
    if (role === "customer" && direct.agentNexconnId) {
      channels.push({ key: "direct", label: view.agent?.name ? `Support (${view.agent.name})` : "Support", ref: { type: "direct", targetId: direct.agentNexconnId, since: since(view) } });
    } else if (view.case.assignedAgentId === viewerUserId && direct.customerNexconnId) {
      channels.push({ key: "direct", label: `Customer (${view.customer.name})`, ref: { type: "direct", targetId: direct.customerNexconnId, since: since(view) } });
    }
  }
  const group = view.threads.find((t) => t.threadType === "group" && t.isActive && t.nexconnGroupId);
  const inGroup = view.participants.some((p) => p.userId === viewerUserId && !p.removedAt);
  if (group?.nexconnGroupId && (inGroup || role === "owner")) {
    channels.push({ key: "group", label: "Service team", ref: { type: "group", groupId: group.nexconnGroupId } });
  }

  const names: Record<string, string> = {};
  for (const p of view.participants) if (p.nexconnUserId) names[p.nexconnUserId] = p.name;
  return { channels, names };
}

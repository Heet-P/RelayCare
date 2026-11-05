import "server-only";
import { signedHeaders } from "./signature";

/**
 * Nexconn Platform Chat API client (server only; App Secret never leaves the backend).
 * Docs: https://docs.nexconn.ai/platform-chat-api
 *
 * Every response carries `code`; 0 = success. Requests fail over from the primary to the
 * backup data-centre domain on network errors / 5xx, as Nexconn recommends.
 */

export class NexconnError extends Error {
  constructor(
    public readonly path: string,
    public readonly code: number | string,
    detail: string,
  ) {
    super(`Nexconn ${path} failed (${code}): ${detail}`);
  }
}

function config() {
  const appKey = process.env.NEXT_PUBLIC_NEXCONN_APP_KEY;
  const appSecret = process.env.NEXCONN_APP_SECRET;
  const primary = process.env.NEXCONN_API_PRIMARY;
  if (!appKey || !appSecret || !primary) throw new Error("Nexconn env vars are not configured");
  const domains = [primary, process.env.NEXCONN_API_BACKUP].filter(Boolean) as string[];
  return { appKey, appSecret, domains: domains.map((d) => (d.startsWith("http") ? d : `https://${d}`)) };
}

async function call<T = Record<string, unknown>>(path: string, body: unknown): Promise<T & { code: number }> {
  const { appKey, appSecret, domains } = config();
  let lastError: unknown;
  for (const base of domains) {
    try {
      const res = await fetch(base + path, {
        method: "POST",
        headers: { ...signedHeaders(appKey, appSecret), "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (res.status >= 500) {
        lastError = new NexconnError(path, res.status, await res.text());
        continue; // try the backup domain
      }
      const json = (await res.json()) as T & { code: number; msg?: string; errorMessage?: string };
      if (json.code !== 0) throw new NexconnError(path, json.code, json.msg ?? json.errorMessage ?? JSON.stringify(json));
      return json;
    } catch (err) {
      if (err instanceof NexconnError && typeof err.code === "number" && err.code < 500) throw err;
      lastError = err;
    }
  }
  throw lastError;
}

/** Issue a user access token. Also registers / refreshes the user's display profile. */
export async function issueAccessToken(user: { userId: string; name: string; avatarUrl?: string }) {
  const res = await call<{ result: { userId: string; accessToken: string } }>("/v4/auth/access-token/issue", user);
  return res.result.accessToken;
}

/** Create a group channel. channelId: ≤64 chars, letters and digits only. userIds ≤ 30. */
export async function createGroupChannel(params: {
  channelId: string;
  name: string;
  owner: string;
  userIds: string[];
  introduction?: string;
}) {
  await call("/v4/group-channel/create", {
    channelId: params.channelId,
    name: params.name.slice(0, 64),
    owner: params.owner,
    userIds: params.userIds,
    groupProfile: params.introduction ? { introduction: params.introduction.slice(0, 512) } : undefined,
  });
}

export async function addGroupMembers(channelId: string, userIds: string[]) {
  if (userIds.length) await call("/v4/group-channel/join", { channelId, userIds });
}

export async function removeGroupMembers(channelId: string, userIds: string[]) {
  if (userIds.length) await call("/v4/group-channel/leave", { channelId, userIds });
}

export async function listGroupMembers(channelId: string) {
  return call<{ result?: { members?: { userId: string }[] } }>("/v4/group-channel/member/list", { channelId });
}

/**
 * Post a text message into a group as `fromUserId` (the sender need not be a member).
 * Used for RelayCare system notices ("Technician joined", handoff summary, evidence refs).
 */
export async function sendGroupText(fromUserId: string, channelId: string, text: string, extra?: Record<string, unknown>) {
  await call("/v4/group-channel/message/send", {
    fromUserId,
    toChannelIds: [channelId],
    messageType: "RC:TxtMsg",
    content: JSON.stringify({ content: text, extra: extra ? JSON.stringify(extra) : undefined }),
    isEchoToSender: 1,
  });
}

export async function sendDirectText(fromUserId: string, toUserId: string, text: string) {
  await call("/v4/direct-channel/message/send", {
    fromUserId,
    toUserIds: [toUserId],
    messageType: "RC:TxtMsg",
    content: JSON.stringify({ content: text }),
    isEchoToSender: 1,
  });
}

/**
 * Browser-side Nexconn Chat SDK wrapper. Import ONLY from client components.
 *
 * - The SDK is loaded lazily (dynamic import) so it never runs during SSR.
 * - NCEngine.initialize() runs exactly once per page lifecycle (spec §9).
 * - One set of NCEngine handlers fans events out to any number of React subscribers.
 * - Translation: target language = the user's locale, auto-translate on (spec §9 "Multi-language").
 */
import type * as Chat from "@nexconn/chat";

export type ConnectionState = "idle" | "connecting" | "connected" | "suspended" | "disconnected" | "error";

export type ChatMessage = {
  id: string;
  channelKey: string;
  senderId: string;
  sentTime: number;
  mine: boolean;
  kind: "text" | "image" | "file" | "other";
  text?: string;
  imageUrl?: string;
  thumbnail?: string;
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
  /** Parsed JSON from content.extra (RelayCare evidence references, system notices). */
  extra?: Record<string, unknown>;
};

/**
 * A direct chat belongs to a pair of people and outlives any one case, so a case view passes
 * `since` (the case's creation time, ms) to show only that case's conversation.
 */
export type ChannelRef = { type: "direct"; targetId: string; since?: number } | { type: "group"; groupId: string };
export const channelKey = (c: ChannelRef) => (c.type === "direct" ? `d:${c.targetId}` : `g:${c.groupId}`);

type Listener<T> = (value: T) => void;
const listeners = {
  state: new Set<Listener<ConnectionState>>(),
  messages: new Set<Listener<ChatMessage[]>>(),
  translations: new Set<Listener<Record<string, string>>>(),
};

let sdkPromise: Promise<typeof Chat> | null = null;
let connectPromise: Promise<string> | null = null;
let currentUserId: string | null = null;
let currentLocale = "en";
let state: ConnectionState = "idle";

export const sdk = () => (sdkPromise ??= import("@nexconn/chat"));

function setState(next: ConnectionState) {
  state = next;
  listeners.state.forEach((l) => l(next));
}

export const getState = () => state;
export const getUserId = () => currentUserId;

export function subscribe<K extends keyof typeof listeners>(
  kind: K,
  fn: (typeof listeners)[K] extends Set<infer L> ? L : never,
) {
  (listeners[kind] as Set<typeof fn>).add(fn);
  return () => void (listeners[kind] as Set<typeof fn>).delete(fn);
}

/** Map an SDK message into a plain object the UI can render. */
export function toChatMessage(m: Chat.Message, me: string | null): ChatMessage {
  const id = m.channelIdentifier;
  // Direct channel ids are always the OTHER party's user id, so they match ChannelRef.targetId.
  const key = id.channelType === 3 /* ChannelType.GROUP */ ? `g:${id.channelId}` : `d:${id.channelId}`;
  const c = m.content as Record<string, unknown>;
  const base: ChatMessage = {
    id: m.messageId,
    channelKey: key,
    senderId: m.senderUserId,
    sentTime: m.sentTime,
    mine: m.senderUserId === me,
    kind: "other",
  };
  try {
    if (typeof c.extra === "string" && c.extra) base.extra = JSON.parse(c.extra);
  } catch {
    // extra is free-form; ignore non-JSON
  }
  switch (m.messageType) {
    case "RC:TxtMsg":
      return { ...base, kind: "text", text: String(c.text ?? c.content ?? "") };
    case "RC:ImgMsg":
      return { ...base, kind: "image", imageUrl: String(c.remoteUrl ?? ""), thumbnail: c.thumbnailBase64 ? `data:image/jpeg;base64,${c.thumbnailBase64}` : undefined };
    case "RC:FileMsg":
      return { ...base, kind: "file", fileName: String(c.name ?? "file"), fileUrl: String(c.remoteUrl ?? ""), fileSize: Number(c.size ?? 0) };
    default:
      return base;
  }
}

/**
 * Initialise (once) and connect with a backend-issued token. Safe to call repeatedly:
 * concurrent callers share one connection attempt. Resolves to the Nexconn user id.
 */
export type TokenSource = () => Promise<{ token: string; locale: string }>;

const backendToken: TokenSource = async () => {
  const res = await fetch("/api/chat/token", { method: "POST", credentials: "include" });
  if (!res.ok) throw new Error(`Chat token request failed (${res.status})`);
  return res.json();
};

export function connect(getToken: TokenSource = backendToken): Promise<string> {
  if (connectPromise) return connectPromise;
  connectPromise = (async () => {
    setState("connecting");
    const { NCEngine, AreaCode, ConnectionStatusHandler, MessageHandler, TranslateHandler } = await sdk();

    const g = globalThis as { __rcNexconnInit?: boolean };
    if (!g.__rcNexconnInit) {
      const area = (process.env.NEXT_PUBLIC_NEXCONN_AREA ?? "SG") as keyof typeof AreaCode;
      NCEngine.initialize({ appKey: process.env.NEXT_PUBLIC_NEXCONN_APP_KEY!, areaCode: AreaCode[area] });
      NCEngine.addConnectionStatusHandler(
        "relaycare",
        new ConnectionStatusHandler({
          onConnectionStatusChanged: ({ status }) =>
            setState((["connected", "connecting", "disconnected", "suspended"] as const)[status] ?? "error"),
        }),
      );
      NCEngine.addMessageHandler(
        "relaycare",
        new MessageHandler({
          onMessageReceived: ({ messages }) => {
            const batch = messages.map((m) => toChatMessage(m, currentUserId));
            listeners.messages.forEach((l) => l(batch));
            // Explicit request so live messages translate even when auto-translate is not applied.
            void translateHistory(batch, currentLocale);
          },
        }),
      );
      NCEngine.addTranslateHandler(
        "relaycare",
        new TranslateHandler({
          onTranslationCompleted: ({ results }) => {
            const map: Record<string, string> = {};
            for (const r of results) {
              if (r.translateInfo?.translatedText) map[r.identifier] = r.translateInfo.translatedText;
              else console.warn("[chat] translation failed", r.identifier, r.code, r.translateInfo?.status);
            }
            if (Object.keys(map).length) listeners.translations.forEach((l) => l(map));
          },
        }),
      );
      g.__rcNexconnInit = true;
    }

    const { token, locale } = await getToken();
    const result = await NCEngine.connect({ token });
    if (!result.isOk) throw new Error(`Nexconn connection failed (${result.code}: ${result.msg})`);
    currentUserId = result.data!.userId;
    currentLocale = locale;

    // Per-user translation settings live in Nexconn; keep them in sync with the profile locale.
    // Translation failing must not block chat, but it must be visible (needs Console enablement).
    const lang = await NCEngine.translateModule.setTranslationLanguage(locale);
    const auto = await NCEngine.translateModule.setAutoTranslateEnabled(true);
    if (!lang.isOk || !auto.isOk) console.warn("[chat] translation setup failed", { lang: lang.code, auto: auto.code });

    setState("connected");
    return currentUserId;
  })().catch((err) => {
    connectPromise = null;
    setState("error");
    throw err;
  });
  return connectPromise;
}

/**
 * Resolves once a connection exists. Channel hooks wait on this instead of calling connect()
 * themselves: child effects run before the parent's, so the connection owner (useConnection)
 * must be the one that chooses the token source.
 */
export function whenConnected(): Promise<string> {
  if (state === "connected" && currentUserId) return Promise.resolve(currentUserId);
  return new Promise((resolve) => {
    const off = subscribe("state", (s) => {
      if (s === "connected" && currentUserId) {
        off();
        resolve(currentUserId);
      }
    });
  });
}

/** Call on sign-out so the next user on this browser gets a fresh connection. */
export async function disconnect() {
  if (!connectPromise) return;
  const { NCEngine } = await sdk();
  await NCEngine.disconnect();
  connectPromise = null;
  currentUserId = null;
  setState("disconnected");
}

export async function channelFor(ref: ChannelRef) {
  const { DirectChannel, GroupChannel } = await sdk();
  return ref.type === "direct" ? new DirectChannel(ref.targetId) : new GroupChannel(ref.groupId);
}

export async function identifierFor(ref: ChannelRef) {
  const { DirectChannelIdentifier, GroupChannelIdentifier } = await sdk();
  return ref.type === "direct" ? new DirectChannelIdentifier(ref.targetId) : new GroupChannelIdentifier(ref.groupId);
}

/** Ask Nexconn to translate already-loaded history (live messages auto-translate). */
export async function translateHistory(messages: ChatMessage[], target: string) {
  const texts = messages.filter((m) => m.kind === "text" && !m.mine && m.text);
  if (!texts.length) return;
  const { NCEngine, TranslateMessageParam } = await sdk();
  const res = await NCEngine.translateModule.translateMessages({
    list: texts.map((m) => new TranslateMessageParam(m.id, undefined, target, m.text)),
    force: false,
  } as Chat.TranslateMessagesParams);
  if (!res.isOk) console.warn("[chat] translateMessages failed", res.code, res.msg);
}

/** Change the translation target for the current connection (profile language switch). */
export async function setChatLanguage(locale: string) {
  currentLocale = locale;
  if (state !== "connected") return; // applied on the next connect()
  const { NCEngine } = await sdk();
  await NCEngine.translateModule.setTranslationLanguage(locale);
}

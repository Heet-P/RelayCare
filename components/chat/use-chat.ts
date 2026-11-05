"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { FileMessageContent, MessagesQuery, SendMediaMessageParams } from "@nexconn/chat";
import {
  channelFor,
  channelKey,
  connect,
  whenConnected,
  getState,
  getUserId,
  identifierFor,
  sdk,
  subscribe,
  toChatMessage,
  translateHistory,
  type ChannelRef,
  type ChatMessage,
  type TokenSource,
} from "@/lib/nexconn/client";

/** Live Nexconn connection state; connects on first use. */
export function useConnection(getToken?: TokenSource) {
  const state = useSyncExternalStore(
    (cb) => subscribe("state", cb),
    getState,
    () => "idle" as const,
  );
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    connect(getToken).catch((e: Error) => setError(e.message));
  }, [getToken]);
  return { state, error, userId: state === "connected" ? getUserId() : null };
}

const PAGE = 30;

/**
 * Message history + live updates + sending for one channel.
 * History: newest page first via createMessagesQuery, older pages on demand.
 * State is per channel: render the consuming component with `key={channelKey(ref)}` so a
 * channel switch remounts it instead of mixing histories.
 */
export function useChannel(ref: ChannelRef | null, locale: string) {
  const key = ref ? channelKey(ref) : null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const query = useRef<MessagesQuery | null>(null);

  const merge = useCallback((incoming: ChatMessage[], where: "start" | "end") => {
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      const next = where === "start" ? [...fresh, ...prev] : [...prev, ...fresh];
      // Order by send time: SDK page order and live-delivery order are not guaranteed.
      return next.sort((a, b) => a.sentTime - b.sentTime);
    });
  }, []);

  const loadPage = useCallback(async () => {
    if (!query.current) return;
    const res = await query.current.loadNextPage();
    if (!res.isOk) throw new Error(`History failed (${res.code})`);
    const me = getUserId();
    const page = res.data!.data.map((m) => toChatMessage(m, me));
    merge(page, "start");
    setHasMore(query.current.hasNext);
    await translateHistory(page, locale);
  }, [merge, locale]);

  useEffect(() => {
    if (!ref || !key) return;
    let cancelled = false;
    const offMsg = subscribe("messages", (batch) => merge(batch.filter((m) => m.channelKey === key), "end"));
    const offTr = subscribe("translations", (map) => setTranslations((t) => ({ ...t, ...map })));

    (async () => {
      await whenConnected();
      const { BaseChannel } = await sdk();
      if (cancelled) return;
      query.current = BaseChannel.createMessagesQuery({
        channelIdentifier: await identifierFor(ref),
        isAscending: false,
        pageSize: PAGE,
      });
      await loadPage();
    })()
      .catch((e) => console.error("[chat] history", e))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
      offMsg();
      offTr();
    };
    // `ref` is identified by `key`; re-run only when the channel changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const sendText = useCallback(
    async (text: string, extra?: Record<string, unknown>) => {
      if (!ref) return;
      const { SendTextMessageParams } = await sdk();
      const channel = await channelFor(ref);
      const res = await channel.sendMessage(
        new SendTextMessageParams({ text, ...(extra ? { extra: JSON.stringify(extra) } : {}) }),
      );
      if (!res.isOk) throw new Error(`Send failed (${res.code}: ${res.msg})`);
      merge([toChatMessage(res.data!, getUserId())], "end");
    },
    [ref, merge],
  );

  /** Conversational attachments (spec §9): images and files through Nexconn media messages. */
  const sendFile = useCallback(
    async (file: File) => {
      if (!ref) return;
      const { Helper } = await sdk();
      const made = file.type.startsWith("image/")
        ? await Helper.createSendImageMessageParams(file)
        : await Helper.createSendFileMessageParams(file);
      if (!made.isOk) throw new Error(`Could not prepare file (${made.code})`);
      const channel = await channelFor(ref);
      const res = await channel.sendMediaMessage(made.data as unknown as SendMediaMessageParams<FileMessageContent>);
      if (!res.isOk) throw new Error(`Upload failed (${res.code}: ${res.msg})`);
      merge([toChatMessage(res.data!, getUserId())], "end");
    },
    [ref, merge],
  );

  return { messages, translations, loading, hasMore, loadOlder: loadPage, sendText, sendFile };
}

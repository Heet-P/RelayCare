"use client";

import { ImagePlus, SendHorizontal, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { channelKey, type ChannelRef, type ChatMessage } from "@/lib/nexconn/client";
import { cn } from "@/lib/utils";
import { useChannel, useConnection } from "./use-chat";

export type ChatChannel = { key: string; label: string; ref: ChannelRef };

/**
 * Case conversation (Nexconn). One tab per channel the viewer may open: the customer↔agent
 * direct chat and, once a technician is assigned, the service-team group. The server decides
 * which channels are offered; a channel id alone never grants access (spec §3).
 */
export function ChatPanel({
  channels,
  names,
  locale,
  className,
}: {
  channels: ChatChannel[];
  /** Nexconn user id → display name */
  names: Record<string, string>;
  /** Viewer's language: incoming messages are translated into it. */
  locale: string;
  className?: string;
}) {
  const { state, error } = useConnection();
  const [active, setActive] = useState(channels.at(-1)?.key);
  const channel = channels.find((c) => c.key === active) ?? channels[0];

  if (!channel) {
    return (
      <div className={cn("panel rounded-xl p-6 text-muted-foreground", className)}>
        The conversation opens once a support agent is assigned.
      </div>
    );
  }

  return (
    <section className={cn("panel flex min-h-0 flex-col overflow-hidden rounded-xl", className)} aria-label="Conversation">
      <header className="flex items-center gap-2 border-b px-3 py-2.5">
        <div className="flex rounded-full bg-muted p-1" role="tablist" aria-label="Conversations">
        {channels.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setActive(c.key)}
            aria-pressed={c.key === channel.key}
            role="tab"
            aria-selected={c.key === channel.key}
            className={cn(
              "pressable h-9 rounded-full px-3.5 text-sm font-medium text-muted-foreground hover:text-foreground",
              c.key === channel.key && "bg-card text-foreground shadow-[0_1px_2px_rgb(28_25_23/0.08),0_2px_8px_-2px_rgb(28_25_23/0.12)]",
            )}
          >
            {c.label}
          </button>
        ))}
        </div>
        {state !== "connected" && (
          <span className="ml-auto flex items-center gap-1 px-2 text-xs text-muted-foreground" role="status">
            {state === "error" ? <WifiOff className="size-3.5" /> : null}
            {state === "error" ? (error ?? "Chat unavailable") : "Connecting…"}
          </span>
        )}
      </header>
      <ChannelView key={channelKey(channel.ref)} channel={channel.ref} names={names} locale={locale} />
    </section>
  );
}

const sameText = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

function ChannelView({ channel, names, locale }: { channel: ChannelRef; names: Record<string, string>; locale: string }) {
  const channelState = useChannel(channel, locale);
  const { translations, loading, hasMore, loadOlder, sendText, sendFile } = channelState;
  // Only this case's part of a direct chat (see ChannelRef.since).
  const since = channel.type === "direct" ? channel.since : undefined;
  const messages = since ? channelState.messages.filter((m) => m.sentTime >= since) : channelState.messages;
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const isGroup = channel.type === "group";

  // Braces matter: scrollIntoView returns a Promise in current browsers, which must not
  // be returned from an effect.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send() {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    try {
      await sendText(text);
      setDraft("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div data-lenis-prevent className="min-h-64 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4" aria-live="polite">
        {hasMore && !(since && channelState.messages.some((m) => m.sentTime < since)) && (
          <button type="button" onClick={() => loadOlder()} className="mx-auto block h-11 text-sm text-primary underline-offset-4 hover:underline">
            Show earlier messages
          </button>
        )}
        {loading && <HistorySkeleton />}
        {!loading && messages.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No messages yet. Write in any language; it&apos;s translated for the other side.
          </p>
        )}
        {messages.map((m, i) => (
          <Bubble
            key={m.id}
            message={m}
            translation={sameText(translations[m.id], m.text) ? undefined : translations[m.id]}
            sender={names[m.senderId] ?? "RelayCare"}
            showSender={isGroup && !m.mine && messages[i - 1]?.senderId !== m.senderId}
          />
        ))}
        <div ref={bottom} />
      </div>
      <form
        className="flex items-end gap-2 border-t p-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label className="pressable grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-accent" aria-label="Send a photo or file">
          <ImagePlus className="size-5" />
          <input
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) sendFile(f).catch((err: Error) => toast.error(err.message));
            }}
          />
        </label>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder="Write a message"
          aria-label="Message"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-[22px] border border-input bg-background px-4 py-2.5 text-base transition-[box-shadow,border-color] duration-200 outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="pressable grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
          aria-label="Send"
        >
          <SendHorizontal className="size-5" />
        </button>
      </form>
    </>
  );
}

const time = (ms: number) => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(ms);

function Bubble({ message: m, translation, sender, showSender }: { message: ChatMessage; translation?: string; sender: string; showSender: boolean }) {
  const [original, setOriginal] = useState(false);
  const evidenceId = typeof m.extra?.attachmentId === "string" ? m.extra.attachmentId : null;
  return (
    <div className={cn("chat-enter flex flex-col gap-1", m.mine ? "items-end" : "items-start")}>
      {showSender && <span className="px-1 text-xs text-muted-foreground">{sender}</span>}
      <div
        className={cn(
          "max-w-[85%] rounded-[20px] px-3.5 py-2.5 break-words whitespace-pre-wrap",
          m.mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-secondary",
        )}
      >
        {m.kind === "text" && <p>{translation && !original ? translation : m.text}</p>}
        {m.kind === "image" && (
          <a href={m.imageUrl} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote chat media */}
            <img src={m.thumbnail ?? m.imageUrl} alt="Photo" className="max-h-60 rounded-md" />
          </a>
        )}
        {m.kind === "file" && (
          <a href={m.fileUrl} target="_blank" rel="noreferrer" className="underline">
            {m.fileName}
          </a>
        )}
        {evidenceId && (
          <a href={`/api/attachments/${evidenceId}`} target="_blank" rel="noreferrer" className="mt-2 block">
            {/* eslint-disable-next-line @next/next/no-img-element -- access-checked evidence redirect */}
            <img src={`/api/attachments/${evidenceId}`} alt="Case evidence" className="max-h-60 rounded-md" />
          </a>
        )}
        {m.kind === "other" && <p className="text-sm italic">Unsupported message</p>}
      </div>
      <span className="flex gap-2 px-1 text-xs text-muted-foreground">
        {time(m.sentTime)}
        {translation && (
          <button type="button" className="underline-offset-4 hover:underline" onClick={() => setOriginal(!original)}>
            {original ? "Show translation" : "Show original"}
          </button>
        )}
      </span>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {["w-2/3", "ml-auto w-1/2", "w-3/5"].map((w) => (
        <div key={w} className={cn("h-12 animate-pulse rounded-lg bg-muted", w)} />
      ))}
    </div>
  );
}

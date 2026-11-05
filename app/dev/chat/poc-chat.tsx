"use client";

import { useCallback, useState } from "react";
import { useChannel, useConnection } from "@/components/chat/use-chat";
import type { ChannelRef } from "@/lib/nexconn/client";

const IDS = { customer: "rcudevcustomer", maya: "rcudevmaya", arjun: "rcudevarjun", ravi: "rcudevravi" };
const LOCALES = { customer: "gu", maya: "en", arjun: "en", ravi: "hi" };
const GROUP = "rcdevpoc1";
type Persona = keyof typeof IDS;

async function devApi(body: object) {
  const res = await fetch("/api/dev/nexconn", { method: "POST", body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? res.statusText);
  return json;
}

export function PocChat({ as }: { as: Persona }) {
  const getToken = useCallback(() => devApi({ action: "token", as }), [as]);
  const { state, error, userId } = useConnection(getToken);
  const [log, setLog] = useState<string[]>([]);
  const note = (s: string) => setLog((l) => [`${new Date().toLocaleTimeString()} ${s}`, ...l]);

  const direct: ChannelRef = { type: "direct", targetId: as === "customer" ? IDS.maya : IDS.customer };
  const group: ChannelRef = { type: "group", groupId: GROUP };

  return (
    <main className="mx-auto grid max-w-6xl gap-4 p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">Nexconn PoC — {as}</h1>
        <span className="rounded bg-black/10 px-2 py-1 text-sm">state: {state}</span>
        <span className="text-sm opacity-70">user: {userId ?? "…"}</span>
        {error && <span className="text-sm text-red-600">{error}</span>}
        <nav className="ml-auto flex gap-2 text-sm">
          {(Object.keys(IDS) as Persona[]).map((p) => (
            <a key={p} className="underline" href={`?as=${p}`} target="_blank">{p}</a>
          ))}
        </nav>
      </header>
      <div className="flex flex-wrap gap-2">
        <button className="rounded border px-3 py-2" onClick={() => devApi({ action: "create-group", groupId: GROUP }).then(() => note("group created"), (e) => note(e.message))}>
          Backend: create group (Arjun + customer + Maya)
        </button>
        <button className="rounded border px-3 py-2" onClick={() => devApi({ action: "add-ravi", groupId: GROUP }).then(() => note("Ravi added"), (e) => note(e.message))}>
          Backend: add 4th user (Ravi)
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {as === "customer" || as === "maya" ? <Pane key="direct" title={`Direct with ${as === "customer" ? "Maya" : "customer"}`} channel={direct} locale={LOCALES[as]} /> : <div />}
        <Pane key="group" title={`Group ${GROUP}`} channel={group} locale={LOCALES[as]} />
      </div>
      <pre className="text-xs opacity-70">{log.join("\n")}</pre>
    </main>
  );
}

function Pane({ title, channel, locale }: { title: string; channel: ChannelRef; locale: string }) {
  const { messages, translations, loading, hasMore, loadOlder, sendText, sendFile } = useChannel(channel, locale);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <section className="flex h-[480px] flex-col rounded border">
      <h2 className="border-b p-2 font-medium">{title}</h2>
      <ol className="flex-1 space-y-2 overflow-y-auto p-2 text-sm">
        {hasMore && <li><button className="underline" onClick={() => loadOlder()}>Load older</button></li>}
        {loading && <li className="opacity-60">loading history…</li>}
        {messages.map((m) => (
          <li key={m.id} className={m.mine ? "text-right" : ""}>
            <span className="opacity-60">{m.senderId}: </span>
            {m.kind === "image" ? <img src={m.thumbnail ?? m.imageUrl} alt="" className="inline h-20" /> : m.kind === "file" ? <a className="underline" href={m.fileUrl}>{m.fileName}</a> : m.text}
            {translations[m.id] && <div className="italic text-blue-700">↳ {translations[m.id]}</div>}
          </li>
        ))}
      </ol>
      <form
        className="flex gap-2 border-t p-2"
        onSubmit={(e) => {
          e.preventDefault();
          sendText(text).then(() => setText(""), (x: Error) => setErr(x.message));
        }}
      >
        <input className="flex-1 rounded border px-2" value={text} onChange={(e) => setText(e.target.value)} placeholder="Message" />
        <input type="file" className="w-28 text-xs" onChange={(e) => e.target.files?.[0] && sendFile(e.target.files[0]).catch((x: Error) => setErr(x.message))} />
        <button className="rounded border px-3">Send</button>
      </form>
      {err && <p className="p-2 text-xs text-red-600">{err}</p>}
    </section>
  );
}

import postgres from "postgres";
import { sessionCookie } from "./session";

// Not BASE_URL: Vite injects its own BASE_URL ("/") into the test environment.
export const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
export const sql = postgres(process.env.DIRECT_URL!, { max: 2 });

export type Who = "owner" | "maya" | "arjun" | "ravi" | "customer" | "anonymous";
const cookies = new Map<Who, string>();

/** Cookie header for a seeded user (cached per run); "" for anonymous. */
export async function as(who: Who) {
  if (who === "anonymous") return "";
  if (!cookies.has(who)) cookies.set(who, await sessionCookie(`${who}@relaycare.test`));
  return cookies.get(who)!;
}

export async function call(who: Who, path: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
  const res = await fetch(BASE_URL + path, {
    method,
    redirect: "manual",
    headers: { "Content-Type": "application/json", cookie: await as(who) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, location: res.headers.get("location"), body: await res.json().catch(() => null) };
}

/** Remove test cases and everything hanging off them (case_events is append-only by trigger). */
export async function deleteCases(ids: string[]) {
  if (!ids.length) return;
  await sql.begin(async (tx) => {
    await tx`alter table case_events disable trigger case_events_no_update`;
    for (const t of ["case_events", "case_attachments", "chat_threads", "case_handoffs", "case_assignments", "case_participants"]) {
      await tx`delete from ${tx(t)} where case_id in ${tx(ids)}`;
    }
    await tx`delete from service_cases where id in ${tx(ids)}`;
    await tx`alter table case_events enable trigger case_events_no_update`;
  });
}

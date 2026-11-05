import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { caseAssignments, chatThreads, customers, orderItems, serviceCases, users } from "@/lib/db/schema";
import { esc, sendEmail } from "@/lib/email/send";
import { sendGroupText } from "@/lib/nexconn/server";

type Kind = "case_created" | "info_requested" | "technician_assigned" | "resolution_pending" | "case_closed";

/** Customer-facing copy per language (en / hi / gu). Keep each message short and specific. */
const COPY: Record<Kind, Record<string, (v: Vars) => { subject: string; body: string }>> = {
  case_created: {
    en: (v) => ({ subject: `We received your report (${v.caseNumber})`, body: `Your report about the ${v.product} is with ${v.agent}. You can follow it and chat with us here:` }),
    hi: (v) => ({ subject: `हमें आपकी शिकायत मिल गई है (${v.caseNumber})`, body: `${v.product} के बारे में आपकी शिकायत ${v.agent} देख रहे हैं। आप यहाँ प्रगति देख सकते हैं और बात कर सकते हैं:` }),
    gu: (v) => ({ subject: `અમને તમારી ફરિયાદ મળી છે (${v.caseNumber})`, body: `${v.product} વિશેની તમારી ફરિયાદ ${v.agent} જોઈ રહ્યા છે. તમે અહીં પ્રગતિ જોઈ શકો છો અને વાત કરી શકો છો:` }),
  },
  info_requested: {
    en: (v) => ({ subject: `${v.agent} has a question about ${v.caseNumber}`, body: `${v.agent} asked: “${v.detail}”. Reply here:` }),
    hi: (v) => ({ subject: `${v.caseNumber} के बारे में ${v.agent} का सवाल`, body: `${v.agent} ने पूछा: “${v.detail}”. यहाँ जवाब दें:` }),
    gu: (v) => ({ subject: `${v.caseNumber} વિશે ${v.agent}નો પ્રશ્ન`, body: `${v.agent} એ પૂછ્યું: “${v.detail}”. અહીં જવાબ આપો:` }),
  },
  technician_assigned: {
    en: (v) => ({ subject: `${v.technician} will repair your ${v.product}`, body: `${v.technician} has your full case details${v.visit ? ` and will visit on ${v.visit}` : ""}. Follow along here:` }),
    hi: (v) => ({ subject: `${v.technician} आपका ${v.product} ठीक करेंगे`, body: `${v.technician} के पास आपके केस की पूरी जानकारी है${v.visit ? ` और वे ${v.visit} को आएँगे` : ""}। यहाँ देखें:` }),
    gu: (v) => ({ subject: `${v.technician} તમારું ${v.product} રિપેર કરશે`, body: `${v.technician} પાસે તમારા કેસની પૂરી માહિતી છે${v.visit ? ` અને તેઓ ${v.visit} ના રોજ આવશે` : ""}. અહીં જુઓ:` }),
  },
  resolution_pending: {
    en: (v) => ({ subject: `Did the repair fix your ${v.product}?`, body: `${v.technician} has finished. Please confirm the problem is fixed, or tell us if it isn't:` }),
    hi: (v) => ({ subject: `क्या आपका ${v.product} ठीक हो गया?`, body: `${v.technician} ने काम पूरा कर लिया है। कृपया पुष्टि करें कि समस्या ठीक हो गई है, या हमें बताएँ:` }),
    gu: (v) => ({ subject: `શું તમારું ${v.product} ઠીક થઈ ગયું?`, body: `${v.technician} એ કામ પૂરું કર્યું છે. કૃપા કરીને પુષ્ટિ કરો કે સમસ્યા ઠીક થઈ ગઈ છે, અથવા અમને જણાવો:` }),
  },
  case_closed: {
    en: (v) => ({ subject: `${v.caseNumber} is closed`, body: `Thanks for confirming. The full history stays with your purchase:` }),
    hi: (v) => ({ subject: `${v.caseNumber} बंद हो गया`, body: `पुष्टि के लिए धन्यवाद। पूरा इतिहास आपकी खरीद के साथ रहेगा:` }),
    gu: (v) => ({ subject: `${v.caseNumber} બંધ થયો`, body: `પુષ્ટિ કરવા બદલ આભાર. સંપૂર્ણ ઇતિહાસ તમારી ખરીદી સાથે રહેશે:` }),
  },
};

type Vars = { caseNumber: string; product: string; agent: string; technician: string; visit: string | null; detail: string };

/**
 * Job `case.notify`: email the customer (in their language) and, for repair completion, post a
 * notice in the case group chat. Email failures are logged, not retried: the case page and
 * chat already carry the same information.
 */
export async function notifyCase({ caseId, kind, detail }: Record<string, unknown>) {
  const k = kind as Kind;
  const [row] = await db
    .select({
      caseNumber: serviceCases.caseNumber,
      product: orderItems.name,
      customerName: customers.name,
      customerEmail: customers.email,
      customerUserId: customers.userId,
      agentId: serviceCases.assignedAgentId,
    })
    .from(serviceCases)
    .innerJoin(orderItems, eq(orderItems.id, serviceCases.orderItemId))
    .innerJoin(customers, eq(customers.id, serviceCases.customerId))
    .where(eq(serviceCases.id, String(caseId)));
  if (!row || !COPY[k]) return;

  const [assignment] = await db
    .select({ technicianId: caseAssignments.technicianId, scheduledAt: caseAssignments.scheduledAt })
    .from(caseAssignments)
    .where(and(eq(caseAssignments.caseId, String(caseId)), inArray(caseAssignments.assignmentStatus, ["assigned", "accepted", "completed"])))
    .orderBy(desc(caseAssignments.createdAt))
    .limit(1);
  const ids = [row.agentId, row.customerUserId, assignment?.technicianId].filter(Boolean) as string[];
  const people = ids.length ? await db.select({ id: users.id, name: users.name, locale: users.locale, nexconnUserId: users.nexconnUserId }).from(users).where(inArray(users.id, ids)) : [];
  const byId = (id?: string | null) => people.find((p) => p.id === id);

  const vars: Vars = {
    caseNumber: row.caseNumber,
    product: row.product,
    agent: byId(row.agentId)?.name ?? "Our support team",
    technician: byId(assignment?.technicianId)?.name ?? "Your technician",
    visit: assignment?.scheduledAt
      ? new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(assignment.scheduledAt)
      : null,
    detail: typeof detail === "string" ? detail : "",
  };
  const locale = byId(row.customerUserId)?.locale ?? "en";
  const msg = (COPY[k][locale] ?? COPY[k].en)(vars);
  const link = `${process.env.NEXT_PUBLIC_APP_URL}/my-cases/${caseId}`;
  const sent = await sendEmail({
    to: row.customerEmail,
    subject: msg.subject,
    text: `${row.customerName},\n\n${msg.body}\n${link}\n\nDemo Electronics, via RelayCare`,
    html: `<p>${esc(row.customerName)},</p><p>${esc(msg.body)}</p><p><a href="${link}">${esc(row.caseNumber)}</a></p><p>Demo Electronics, via RelayCare</p>`,
  });
  if (!sent) console.warn(`[notify] ${k} email for ${row.caseNumber} not sent`);

  // Repair finished: tell the whole service group, from the technician, in the chat.
  if (k === "resolution_pending") {
    const [group] = await db
      .select({ id: chatThreads.nexconnGroupId })
      .from(chatThreads)
      .where(and(eq(chatThreads.caseId, String(caseId)), eq(chatThreads.threadType, "group")));
    const tech = byId(assignment?.technicianId);
    if (group?.id && tech?.nexconnUserId) {
      await sendGroupText(tech.nexconnUserId, group.id, `${tech.name} has finished the repair. The report and photos are on the case page. Please confirm it's fixed.`, {
        kind: "system",
        event: "work_completed",
      });
    }
  }
}

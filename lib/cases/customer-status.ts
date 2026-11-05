import type { CaseStatus } from "./state-machine";

/** Customer-facing progress (spec §4D: customers should not need to understand dispatch internals). */
export const CUSTOMER_STEPS = ["Reported", "Reviewing", "Technician", "Repair", "Resolved"] as const;

type Ctx = { agent?: string | null; technician?: string | null; visitAt?: Date | null };

export function customerStatus(status: CaseStatus, ctx: Ctx = {}): { step: number; headline: string; next: string } {
  const agent = ctx.agent ?? "A support agent";
  const tech = ctx.technician ?? "Your technician";
  const visit = ctx.visitAt
    ? new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(ctx.visitAt)
    : null;
  switch (status) {
    case "submitted":
      return { step: 0, headline: "We've received your report", next: `${agent} will review it shortly. You can add photos or details below.` };
    case "under_triage":
      return { step: 1, headline: "Reviewing your report", next: `${agent} is looking at your report and may message you with questions.` };
    case "warranty_review":
      return { step: 1, headline: "Checking your warranty", next: "We're confirming your warranty cover. No action needed from you." };
    case "awaiting_customer":
      return { step: 1, headline: "We need a little more from you", next: `${agent} has asked a question. Reply in the conversation below.` };
    case "escalated":
      return { step: 1, headline: "A senior team member is on it", next: "Your case has been escalated. We'll update you here." };
    case "reopened":
      return { step: 1, headline: "We're looking at it again", next: "You told us the problem isn't fixed. The team is reviewing what happens next." };
    case "awaiting_assignment":
      return { step: 2, headline: "Arranging a technician", next: "We're choosing a technician near you." };
    case "assigned":
      return { step: 2, headline: `${tech} will handle your repair`, next: `${tech} has your full case details and will confirm a visit time.` };
    case "scheduled":
      return { step: 2, headline: "Visit booked", next: visit ? `${tech} will visit on ${visit}.` : `${tech} will confirm the visit time.` };
    case "in_progress":
      return { step: 3, headline: "Repair in progress", next: `${tech} is working on your product.` };
    case "resolution_pending":
      return { step: 3, headline: "Did this fix the problem?", next: "Check the repair report below and confirm, or tell us if it's still not right." };
    case "resolved":
      return { step: 4, headline: "Resolved", next: "Thanks for confirming. The store will close this case." };
    case "closed":
      return { step: 4, headline: "Case closed", next: "The full history stays here with your purchase." };
    case "rejected":
      return { step: 1, headline: "We couldn't take this on", next: "See the conversation for the reason and what you can do next." };
    case "cancelled":
      return { step: 0, headline: "Cancelled", next: "You cancelled this case. You can report a new problem any time." };
  }
}

type Line = { headline: string; next: string };
type Names = { agent: string; tech: string; visit: string | null };

/** Hindi and Gujarati versions of the customer progress text (spec: Gujarati customer, Hindi technician). */
const LOCALIZED: Record<"hi" | "gu", Partial<Record<CaseStatus, (n: Names) => Line>>> = {
  gu: {
    submitted: (n) => ({ headline: "અમને તમારી ફરિયાદ મળી છે", next: `${n.agent} ટૂંક સમયમાં તેને જોશે. તમે નીચે ફોટા અથવા વિગતો ઉમેરી શકો છો.` }),
    under_triage: (n) => ({ headline: "તમારી ફરિયાદની તપાસ ચાલુ છે", next: `${n.agent} તમારી ફરિયાદ જોઈ રહ્યા છે અને પ્રશ્ન પૂછી શકે છે.` }),
    warranty_review: () => ({ headline: "તમારી વોરંટી ચકાસી રહ્યા છીએ", next: "અમે તમારી વોરંટી કવર ચકાસી રહ્યા છીએ. તમારે કંઈ કરવાની જરૂર નથી." }),
    awaiting_customer: (n) => ({ headline: "અમને તમારી પાસેથી થોડી વધુ માહિતી જોઈએ છે", next: `${n.agent} એ પ્રશ્ન પૂછ્યો છે. નીચે વાતચીતમાં જવાબ આપો.` }),
    awaiting_assignment: () => ({ headline: "ટેકનિશિયન નક્કી કરી રહ્યા છીએ", next: "અમે તમારી નજીકના ટેકનિશિયનને પસંદ કરી રહ્યા છીએ." }),
    assigned: (n) => ({ headline: `${n.tech} તમારું રિપેર કરશે`, next: `${n.tech} પાસે તમારા કેસની પૂરી માહિતી છે અને તેઓ મુલાકાતનો સમય નક્કી કરશે.` }),
    scheduled: (n) => ({ headline: "મુલાકાત નક્કી થઈ ગઈ છે", next: n.visit ? `${n.tech} ${n.visit} ના રોજ આવશે.` : `${n.tech} મુલાકાતનો સમય જણાવશે.` }),
    in_progress: (n) => ({ headline: "રિપેર ચાલુ છે", next: `${n.tech} તમારા પ્રોડક્ટ પર કામ કરી રહ્યા છે.` }),
    resolution_pending: () => ({ headline: "શું સમસ્યા ઠીક થઈ ગઈ?", next: "નીચે રિપેર રિપોર્ટ જુઓ અને પુષ્ટિ કરો, અથવા જણાવો કે હજી બરાબર નથી." }),
    resolved: () => ({ headline: "ઉકેલાઈ ગયું", next: "પુષ્ટિ કરવા બદલ આભાર. સ્ટોર આ કેસ બંધ કરશે." }),
    closed: () => ({ headline: "કેસ બંધ", next: "સંપૂર્ણ ઇતિહાસ તમારી ખરીદી સાથે અહીં રહેશે." }),
    reopened: () => ({ headline: "અમે ફરીથી જોઈ રહ્યા છીએ", next: "તમે જણાવ્યું કે સમસ્યા ઠીક નથી થઈ. ટીમ આગળનું પગલું જોઈ રહી છે." }),
  },
  hi: {
    submitted: (n) => ({ headline: "हमें आपकी शिकायत मिल गई है", next: `${n.agent} जल्द ही इसे देखेंगे। आप नीचे फ़ोटो या जानकारी जोड़ सकते हैं।` }),
    under_triage: (n) => ({ headline: "आपकी शिकायत की जाँच हो रही है", next: `${n.agent} आपकी शिकायत देख रहे हैं और सवाल पूछ सकते हैं।` }),
    awaiting_customer: (n) => ({ headline: "हमें आपसे थोड़ी और जानकारी चाहिए", next: `${n.agent} ने सवाल पूछा है। नीचे बातचीत में जवाब दें।` }),
    scheduled: (n) => ({ headline: "विज़िट तय हो गई है", next: n.visit ? `${n.tech} ${n.visit} को आएँगे।` : `${n.tech} विज़िट का समय बताएँगे।` }),
    in_progress: (n) => ({ headline: "मरम्मत चल रही है", next: `${n.tech} आपके प्रोडक्ट पर काम कर रहे हैं।` }),
    resolution_pending: () => ({ headline: "क्या समस्या ठीक हो गई?", next: "नीचे रिपोर्ट देखें और पुष्टि करें, या बताएँ कि अभी भी ठीक नहीं है।" }),
    resolved: () => ({ headline: "हल हो गया", next: "पुष्टि के लिए धन्यवाद।" }),
  },
};

/** customerStatus in the viewer's language (falls back to English per status). */
export function customerStatusIn(locale: string, status: CaseStatus, ctx: Ctx = {}) {
  const base = customerStatus(status, ctx);
  const fn = (locale === "gu" || locale === "hi" ? LOCALIZED[locale] : undefined)?.[status];
  if (!fn) return base;
  const visit = ctx.visitAt
    ? new Intl.DateTimeFormat(locale === "gu" ? "gu-IN" : "hi-IN", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(ctx.visitAt)
    : null;
  return { step: base.step, ...fn({ agent: ctx.agent ?? (locale === "gu" ? "સપોર્ટ ટીમ" : "सपोर्ट टीम"), tech: ctx.technician ?? (locale === "gu" ? "તમારા ટેકનિશિયન" : "आपके तकनीशियन"), visit }) };
}

/** Display formatting shared by server and client components (en-IN for the demo store). */
export const money = (amount: string | number | null, currency: string | null) =>
  amount == null
    ? "—"
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: currency ?? "INR", maximumFractionDigits: 0 }).format(Number(amount));

export const date = (d: Date | string | null) =>
  d ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(d)) : "—";

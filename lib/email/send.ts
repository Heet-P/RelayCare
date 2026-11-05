import "server-only";
import { Resend } from "resend";

/**
 * Transactional email through Resend. Returns false (never throws) so callers can fall back,
 * e.g. show a copyable link when the sending domain is not verified yet.
 */
export async function sendEmail(msg: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return false;
  try {
    const { error } = await new Resend(key).emails.send({ from, ...msg });
    if (error) console.warn("[email] Resend refused:", error.message);
    return !error;
  } catch (e) {
    console.warn("[email] send failed:", (e as Error).message);
    return false;
  }
}

/** Minimal escaping for values interpolated into email HTML. */
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

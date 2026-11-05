import { getActor } from "@/lib/auth/session";
import { LanguageSwitch } from "./language-switch";

/** Language switch for the signed-in user (reads the session; render inside <Suspense>). */
export async function MyLanguage() {
  const actor = await getActor();
  return actor ? <LanguageSwitch locale={actor.user.locale} /> : null;
}

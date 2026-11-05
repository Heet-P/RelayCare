import { getActor } from "@/lib/auth/session";
import { tr } from "@/lib/i18n";
import { CustomerTabs } from "./tabs";

/** Tabs in the signed-in customer's language (reads the session, so render inside <Suspense>). */
export async function LocalizedTabs() {
  const t = tr((await getActor())?.user.locale);
  return <CustomerTabs labels={{ purchases: t.purchases, myCases: t.myCases }} />;
}

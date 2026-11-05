import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";

/** Signed-out visitors go to email-code sign-in. Pages still authorize their own data. */
export async function CustomerGuard() {
  const actor = await getActor();
  if (!actor) redirect("/verify");
  return null;
}

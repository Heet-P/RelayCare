import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";

/** Sends signed-out visitors and non-staff away from /dashboard (pages still check their own access). */
export async function StaffGuard() {
  const actor = await getActor();
  if (!actor) redirect("/login?next=/dashboard");
  if (!actor.memberships.some((m) => m.role !== "technician")) redirect("/");
  return null;
}

import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";

/** Only technicians use this workspace; everyone else is sent home. Pages still authorize. */
export async function TechnicianGuard() {
  const actor = await getActor();
  if (!actor) redirect("/login?next=/technician/jobs");
  if (!actor.memberships.some((m) => m.role === "technician")) redirect("/workspace");
  return null;
}

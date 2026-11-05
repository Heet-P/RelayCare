import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";

/** "/workspace" sends each person to their own area (staff, technician, customer). */
export async function GET() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const roles = actor.memberships.map((m) => m.role);
  if (roles.some((r) => r !== "technician")) redirect("/dashboard");
  if (roles.includes("technician")) redirect("/technician/jobs");
  redirect("/my-orders");
}

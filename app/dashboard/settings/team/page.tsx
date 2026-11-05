import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOrgRole } from "@/lib/auth/access";
import { db } from "@/lib/db/client";
import { organizationMemberships, users } from "@/lib/db/schema";
import { InviteForm, MemberRow } from "./client";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-3xl rounded-lg" />}>
      <Team />
    </Suspense>
  );
}

async function Team() {
  const { organizationId, role, actor } = await requireOrgRole(["owner", "support_agent", "dispatcher"]);
  const members = await db
    .select({ userId: users.id, name: users.name, email: users.email, role: organizationMemberships.role, isActive: organizationMemberships.isActive, signedUp: users.authUserId })
    .from(organizationMemberships)
    .innerJoin(users, eq(users.id, organizationMemberships.userId))
    .where(and(eq(organizationMemberships.organizationId, organizationId)))
    .orderBy(asc(users.name));
  const isOwner = role === "owner";

  return (
    <div className="max-w-3xl space-y-8">
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Team</h2>
          <p className="text-muted-foreground">
            Support agents review reports, dispatchers assign technicians, technicians see only the jobs given to them.
          </p>
        </div>
        <ul className="divide-y panel rounded-xl">
          {members.map((m) => (
            <MemberRow key={m.userId} member={{ ...m, signedUp: !!m.signedUp }} editable={isOwner && m.userId !== actor.user.id} />
          ))}
        </ul>
      </section>
      {isOwner && <InviteForm />}
    </div>
  );
}

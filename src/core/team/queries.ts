import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { Database } from "@/core/db";
import { getUserDisplayInfoByIds } from "@/core/user-lookup";
import { membershipModules, memberships, organizations } from "@/db/schema";

export interface TeamMember {
  id: string;
  userId: string;
  role: "owner" | "staff";
  active: boolean;
  department: string | null;
  name: string;
  email: string | null;
  moduleSlugs: string[];
}

export interface TeamOverview {
  multiUser: boolean;
  seatLimit: number;
  activeCount: number;
  members: TeamMember[];
}

/** Equipe da organização + quantos assentos estão em uso (só ativos contam). */
export async function getTeamOverview(db: Database, organizationId: string): Promise<TeamOverview> {
  const [org] = await db
    .select({ multiUser: organizations.multiUser, seatLimit: organizations.seatLimit })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  const [rows, grants] = await Promise.all([
    db
      .select({
        id: memberships.id,
        userId: memberships.userId,
        role: memberships.role,
        active: memberships.active,
        department: memberships.department,
      })
      .from(memberships)
      .where(eq(memberships.organizationId, organizationId))
      .orderBy(asc(memberships.createdAt), asc(memberships.id)),
    db
      .select({
        membershipId: membershipModules.membershipId,
        moduleSlug: membershipModules.moduleSlug,
      })
      .from(membershipModules)
      .where(eq(membershipModules.organizationId, organizationId)),
  ]);

  const info = await getUserDisplayInfoByIds(
    db,
    rows.map((r) => r.userId),
  );

  const slugsByMembership = new Map<string, string[]>();
  for (const g of grants) {
    const list = slugsByMembership.get(g.membershipId) ?? [];
    list.push(g.moduleSlug);
    slugsByMembership.set(g.membershipId, list);
  }

  return {
    multiUser: org?.multiUser ?? false,
    seatLimit: org?.seatLimit ?? 1,
    activeCount: rows.filter((r) => r.active).length,
    members: rows.map((r) => ({
      ...r,
      name: info.get(r.userId)?.name ?? r.userId,
      email: info.get(r.userId)?.email ?? null,
      moduleSlugs: slugsByMembership.get(r.id) ?? [],
    })),
  };
}

/** Uma membership `staff` da organização — usado para confirmar que o id
 * recebido do cliente realmente pertence a esta organização. */
export async function findStaffMembership(
  db: Database,
  organizationId: string,
  membershipId: string,
) {
  const [row] = await db
    .select({ id: memberships.id, userId: memberships.userId, active: memberships.active })
    .from(memberships)
    .where(
      and(
        eq(memberships.id, membershipId),
        eq(memberships.organizationId, organizationId),
        eq(memberships.role, "staff"),
      ),
    )
    .limit(1);
  return row ?? null;
}

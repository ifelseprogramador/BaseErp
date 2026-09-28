import "server-only";
import { desc, eq, ilike } from "drizzle-orm";
import type { Database } from "@/core/db";
import { getAuditLogForOrg } from "@/core/admin/audit";
import { getUserDisplayInfoByIds } from "@/core/user-lookup";
import { memberships, organizationModuleSettings, organizations } from "@/db/schema";

export async function listOrganizationsForAdmin(db: Database, search?: string) {
  const term = search?.trim();
  const query = db
    .select({
      id: organizations.id,
      name: organizations.name,
      status: organizations.status,
      billingStatus: organizations.billingStatus,
      nextDueDate: organizations.nextDueDate,
      createdAt: organizations.createdAt,
    })
    .from(organizations)
    .orderBy(desc(organizations.createdAt));

  return term ? query.where(ilike(organizations.name, `%${term}%`)) : query;
}

/**
 * BaseERP não tem módulos de negócio ainda (ver src/modules/README.md) —
 * por isso, diferente do mecano-erp, esta consulta NÃO calcula
 * `customerCount`/`vehicleCount` (não há `customers`/`vehicles` para
 * contar). Um vertical que crie módulos de negócio pode acrescentar
 * contagens próprias sem reintroduzir essas duas aqui.
 */
export async function getOrganizationForAdmin(db: Database, organizationId: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!org) return null;

  const [members, moduleSettings, audit] = await Promise.all([
    db
      .select({
        id: memberships.id,
        userId: memberships.userId,
        role: memberships.role,
        active: memberships.active,
      })
      .from(memberships)
      .where(eq(memberships.organizationId, organizationId)),
    db
      .select()
      .from(organizationModuleSettings)
      .where(eq(organizationModuleSettings.organizationId, organizationId)),
    getAuditLogForOrg(db, organizationId),
  ]);

  const userIds = [...members.map((m) => m.userId), ...audit.map((a) => a.actorUserId)];
  const displayInfoById = await getUserDisplayInfoByIds(db, userIds);

  return {
    organization: org,
    members: members.map((m) => {
      const info = displayInfoById.get(m.userId);
      return { ...m, email: info?.email ?? null, name: info?.name ?? m.userId };
    }),
    moduleSettings,
    audit: audit.map((a) => ({
      ...a,
      actorName: displayInfoById.get(a.actorUserId)?.name ?? a.actorUserId,
    })),
  };
}

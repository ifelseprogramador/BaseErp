import "server-only";
import { desc, eq, ilike, sql } from "drizzle-orm";
import type { Database } from "@/core/db";
import { getAuditLogForOrg } from "@/core/admin/audit";
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

  // auth.users não é modelado pelo Drizzle (schema gerenciado pelo Supabase
  // Auth) — lido com SQL bruto, na mesma conexão/transação.
  const userIds = new Set([...members.map((m) => m.userId), ...audit.map((a) => a.actorUserId)]);
  const users =
    userIds.size > 0
      ? await db.execute<{ id: string; email: string | null }>(
          sql`select id, email from auth.users where id in (${sql.join(
            Array.from(userIds).map((id) => sql`${id}`),
            sql`, `,
          )})`,
        )
      : [];

  const emailById = new Map(Array.from(users).map((u) => [u.id, u.email]));

  return {
    organization: org,
    members: members.map((m) => ({ ...m, email: emailById.get(m.userId) ?? null })),
    moduleSettings,
    audit: audit.map((a) => ({ ...a, actorEmail: emailById.get(a.actorUserId) ?? a.actorUserId })),
  };
}

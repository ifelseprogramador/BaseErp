import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { withOrg } from "@/core/auth";
import { requireAdmin } from "@/core/admin-auth";
import { liveSessions, organizations } from "@/db/schema";

const OPEN_STATUSES = ["pending", "active"] as const;

/** A sessão em aberto (pedida ou já ativa) da organização do usuário logado, se houver. */
export async function getOpenSessionForMyOrg() {
  const { organizationId, withDb } = await withOrg();

  return withDb(async (db) => {
    const [session] = await db
      .select()
      .from(liveSessions)
      .where(
        and(
          eq(liveSessions.organizationId, organizationId),
          inArray(liveSessions.status, OPEN_STATUSES),
        ),
      )
      .orderBy(desc(liveSessions.createdAt))
      .limit(1);

    return session ?? null;
  });
}

/** Pedidos de suporte que uma organização abriu e ainda esperam um admin
 * aceitar — inbox do dashboard. */
export async function listPendingUserRequestsForAdmin() {
  const { withDb } = await requireAdmin();

  return withDb((db) =>
    db
      .select({
        sessionId: liveSessions.id,
        organizationId: liveSessions.organizationId,
        organizationName: organizations.name,
      })
      .from(liveSessions)
      .innerJoin(organizations, eq(organizations.id, liveSessions.organizationId))
      .where(and(eq(liveSessions.status, "pending"), eq(liveSessions.initiatedBy, "user")))
      .orderBy(desc(liveSessions.createdAt)),
  );
}

export async function getSessionByIdForAdmin(sessionId: string) {
  const { withDb } = await requireAdmin();

  return withDb(async (db) => {
    const [session] = await db
      .select()
      .from(liveSessions)
      .where(eq(liveSessions.id, sessionId))
      .limit(1);
    return session ?? null;
  });
}

/** Sessão em aberto (se houver) de uma organização específica — para a
 * ficha em /admin. */
export async function getOpenSessionForOrgAdmin(organizationId: string) {
  const { withDb } = await requireAdmin();

  return withDb(async (db) => {
    const [session] = await db
      .select()
      .from(liveSessions)
      .where(
        and(
          eq(liveSessions.organizationId, organizationId),
          inArray(liveSessions.status, OPEN_STATUSES),
        ),
      )
      .orderBy(desc(liveSessions.createdAt))
      .limit(1);

    return session ?? null;
  });
}

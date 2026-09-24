import "server-only";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { withOrg } from "@/core/auth";
import { requireAdmin } from "@/core/admin-auth";
import { notificationReads, notifications } from "@/db/schema/notifications";
import { organizations } from "@/db/schema/tenancy";

/**
 * Notificações visíveis pra organização de quem está logado — "pra
 * todos" (`organization_id` nulo) ou só a dela — com `read` já
 * calculado pra ESTA pessoa (`userId`), mais recente primeiro. As que
 * ela apagou do sino (`dismissedAt`) ficam de fora.
 */
export async function listNotificationsForCurrentUser() {
  const { organizationId, userId, withDb } = await withOrg();

  return withDb((db) =>
    db
      .select({
        id: notifications.id,
        title: notifications.title,
        body: notifications.body,
        category: notifications.category,
        createdAt: notifications.createdAt,
        readAt: notificationReads.readAt,
      })
      .from(notifications)
      .leftJoin(
        notificationReads,
        and(
          eq(notificationReads.notificationId, notifications.id),
          eq(notificationReads.userId, userId),
        ),
      )
      .where(
        and(
          or(
            isNull(notifications.organizationId),
            eq(notifications.organizationId, organizationId),
          ),
          isNull(notificationReads.dismissedAt),
        ),
      )
      .orderBy(desc(notifications.createdAt)),
  );
}

export async function countUnreadForCurrentUser(): Promise<number> {
  const rows = await listNotificationsForCurrentUser();
  return rows.filter((r) => !r.readAt).length;
}

// --- lado do admin -----------------------------------------------------

export async function listNotificationsForAdmin() {
  const { withDb } = await requireAdmin();

  return withDb((db) =>
    db
      .select({
        id: notifications.id,
        title: notifications.title,
        body: notifications.body,
        category: notifications.category,
        organizationId: notifications.organizationId,
        organizationName: organizations.name,
        createdAt: notifications.createdAt,
        updatedAt: notifications.updatedAt,
      })
      .from(notifications)
      .leftJoin(organizations, eq(organizations.id, notifications.organizationId))
      .orderBy(desc(notifications.createdAt)),
  );
}

export async function getNotificationForAdmin(notificationId: string) {
  const { withDb } = await requireAdmin();

  return withDb(async (db) => {
    const [notification] = await db
      .select({
        id: notifications.id,
        title: notifications.title,
        body: notifications.body,
        category: notifications.category,
        organizationId: notifications.organizationId,
        organizationName: organizations.name,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .leftJoin(organizations, eq(organizations.id, notifications.organizationId))
      .where(eq(notifications.id, notificationId))
      .limit(1);

    if (!notification) return null;

    const readerRows = await db
      .select({
        userId: notificationReads.userId,
        organizationId: notificationReads.organizationId,
        organizationName: organizations.name,
        readAt: notificationReads.readAt,
      })
      .from(notificationReads)
      .innerJoin(organizations, eq(organizations.id, notificationReads.organizationId))
      .where(eq(notificationReads.notificationId, notificationId))
      .orderBy(desc(notificationReads.readAt));

    // auth.users não é modelado pelo Drizzle — mesmo padrão de
    // core/admin/queries.ts#getOrganizationForAdmin (SQL bruto, mesma
    // conexão/transação já enxerga o schema `auth`).
    const userIds = readerRows.map((r) => r.userId);
    const users =
      userIds.length > 0
        ? await db.execute<{ id: string; email: string | null }>(
            sql`select id, email from auth.users where id in (${sql.join(
              userIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          )
        : [];
    const emailById = new Map(Array.from(users).map((u) => [u.id, u.email]));

    const readers = readerRows.map((r) => ({ ...r, email: emailById.get(r.userId) ?? null }));

    return { ...notification, readers };
  });
}

import "server-only";
import { and, asc, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import type { Database } from "@/core/db";
import { withOrg } from "@/core/auth";
import { requireAdmin } from "@/core/admin-auth";
import { getUserDisplayInfoByIds } from "@/core/user-lookup";
import { liveSessions, memberships, organizations } from "@/db/schema";

const OPEN_STATUSES = ["pending", "active", "chat"] as const;

/**
 * Fecha pedidos `pending` cujo prazo (`expires_at`) já passou, sem cron: roda
 * nos pontos onde "existe pedido pendente" importa (abrir/ler sessão, caixa de
 * entrada). Pedido do USUÁRIO com a espera esgotada (aba fechada antes de a
 * contagem zerar, ninguém para disparar `expireSupportRequest`) vira `missed`
 * — o admin vê "Sem atendimento" em vez de "Esperando agora" para quem já
 * saiu. Pedido do ADMIN sem resposta vira `ended` (não fica pendurado
 * mostrando o aviso para sempre). Cada contexto só enxerga o que a RLS
 * permite: o da pessoa varre as próprias sessões, o do admin varre todas.
 */
export async function expireStalePendingSessions(db: Database) {
  await db
    .update(liveSessions)
    .set({ status: "missed" })
    .where(
      and(
        eq(liveSessions.status, "pending"),
        eq(liveSessions.initiatedBy, "user"),
        lt(liveSessions.expiresAt, sql`now() - interval '15 seconds'`),
      ),
    );
  await db
    .update(liveSessions)
    .set({ status: "ended", endedAt: new Date(), controlGranted: false })
    .where(
      and(
        eq(liveSessions.status, "pending"),
        eq(liveSessions.initiatedBy, "admin"),
        lt(liveSessions.expiresAt, sql`now()`),
      ),
    );
}

/**
 * A sessão em aberto (pedida ou já ativa) DA PESSOA logada, se houver. O
 * nome ficou `...ForMyOrg` por compatibilidade com o layout, mas desde o
 * multiusuário a sessão é da pessoa (`subjectUserId`): colega de empresa
 * nunca recebe a sessão do outro (a RLS também impede).
 */
export async function getOpenSessionForMyOrg() {
  const { userId, withDb } = await withOrg();

  return withDb(async (db) => {
    await expireStalePendingSessions(db);
    const [session] = await db
      .select()
      .from(liveSessions)
      .where(
        and(eq(liveSessions.subjectUserId, userId), inArray(liveSessions.status, OPEN_STATUSES)),
      )
      .orderBy(desc(liveSessions.createdAt))
      .limit(1);

    return session ?? null;
  });
}

export interface SupportRequestRow {
  sessionId: string;
  organizationId: string;
  organizationName: string;
  subjectUserId: string | null;
  userName: string;
  /** `pending` = ainda dentro do tempo de espera; `missed` = ninguém atendeu;
   * `chat` = conversa só por texto em andamento (veio do Telegram). */
  status: "pending" | "missed" | "chat";
  createdAt: Date;
}

/** Pedidos de suporte abertos por pessoas que ainda precisam de um admin:
 * esperando atendimento (`pending`) e perdidos (`missed`) — caixa de entrada
 * do painel. Pedido que o próprio admin abriu (`initiatedBy = admin`) não
 * entra aqui. */
export async function listPendingUserRequestsForAdmin(): Promise<SupportRequestRow[]> {
  const { withDb } = await requireAdmin();

  return withDb(async (db) => {
    await expireStalePendingSessions(db);
    const rows = await db
      .select({
        sessionId: liveSessions.id,
        organizationId: liveSessions.organizationId,
        organizationName: organizations.name,
        subjectUserId: liveSessions.subjectUserId,
        status: liveSessions.status,
        createdAt: liveSessions.createdAt,
      })
      .from(liveSessions)
      .innerJoin(organizations, eq(organizations.id, liveSessions.organizationId))
      .where(
        and(
          eq(liveSessions.initiatedBy, "user"),
          or(
            eq(liveSessions.status, "pending"),
            eq(liveSessions.status, "missed"),
            eq(liveSessions.status, "chat"),
          ),
        ),
      )
      .orderBy(desc(liveSessions.createdAt))
      .limit(50);

    const names = await getUserDisplayInfoByIds(
      db,
      rows.map((r) => r.subjectUserId).filter((id): id is string => Boolean(id)),
    );

    return rows.map((r) => ({
      sessionId: r.sessionId,
      organizationId: r.organizationId,
      organizationName: r.organizationName,
      subjectUserId: r.subjectUserId,
      userName: (r.subjectUserId && names.get(r.subjectUserId)?.name) || "Usuário",
      status: r.status as "pending" | "missed" | "chat",
      createdAt: r.createdAt,
    }));
  });
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
 * ficha em /admin (a de qualquer pessoa dela, a mais recente). */
export async function getOpenSessionForOrgAdmin(organizationId: string) {
  const { withDb } = await requireAdmin();

  return withDb(async (db) => {
    await expireStalePendingSessions(db);
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

/** Pessoas ativas da organização que o admin pode pedir para ver (ficha em /admin). */
export async function listSupportTargetsForOrg(organizationId: string) {
  const { withDb } = await requireAdmin();

  return withDb(async (db) => {
    const members = await db
      .select({ userId: memberships.userId, role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.organizationId, organizationId), eq(memberships.active, true)))
      .orderBy(asc(memberships.createdAt));
    const names = await getUserDisplayInfoByIds(
      db,
      members.map((m) => m.userId),
    );
    return members.map((m) => ({
      userId: m.userId,
      name: names.get(m.userId)?.name ?? m.userId,
      role: m.role,
    }));
  });
}

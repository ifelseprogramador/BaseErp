"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { withOrg, getSession, getActiveOrg } from "@/core/auth";
import { requireAdmin } from "@/core/admin-auth";
import { isPlatformAdmin } from "@/core/platform-admin";
import { runWithUserContext } from "@/core/db";
import { liveSessions, memberships, organizations } from "@/db/schema";
import { recordAudit } from "@/core/admin/audit";
import { sendBroadcast as broadcast } from "@/core/supabase/realtime-sender";
import type { ActionResult } from "@/core/action-result";
import {
  adminSupportInboxChannelName,
  liveSessionChannelName,
  orgSupportChannelName,
} from "./realtime";

const OPEN_STATUSES = ["pending", "active"] as const;

interface SessionActionResult extends ActionResult {
  sessionId?: string;
}

/** Admin pede acesso à tela de uma organização. Ver core/admin/components/live-support-card.tsx. */
export async function requestSupportAccess(organizationId: string): Promise<SessionActionResult> {
  const { userId, log, withDb } = await requireAdmin();

  const result = await withDb(async (db) => {
    const [existing] = await db
      .select({ id: liveSessions.id })
      .from(liveSessions)
      .where(
        and(
          eq(liveSessions.organizationId, organizationId),
          inArray(liveSessions.status, OPEN_STATUSES),
        ),
      )
      .limit(1);
    if (existing) return null;

    const [session] = await db
      .insert(liveSessions)
      .values({ organizationId, initiatedBy: "admin", adminUserId: userId, status: "pending" })
      .returning({ id: liveSessions.id });

    await recordAudit(db, {
      actorUserId: userId,
      organizationId,
      action: "live_support.solicitar",
    });
    return session;
  });

  if (!result) {
    return {
      ok: false,
      message: "Já existe uma sessão de suporte em aberto para esta organização.",
    };
  }

  log.warn("live_support.solicitar", { organizationId, sessionId: result.id });
  await broadcast(orgSupportChannelName(organizationId), "request", { sessionId: result.id });

  revalidatePath(`/admin/organizacoes/${organizationId}`);
  return { ok: true, sessionId: result.id };
}

/** Usuário da organização chama o suporte. Botão em (app), ver live-support-widget.tsx. */
export async function callForSupport(): Promise<SessionActionResult> {
  const { userId, organizationId, log, withDb } = await withOrg();
  const { organizationName } = await getActiveOrg();

  const session = await withDb(async (db) => {
    const [existing] = await db
      .select({ id: liveSessions.id })
      .from(liveSessions)
      .where(
        and(
          eq(liveSessions.organizationId, organizationId),
          inArray(liveSessions.status, OPEN_STATUSES),
        ),
      )
      .limit(1);
    if (existing) return existing; // já tem uma pendente/ativa, só devolve

    const [created] = await db
      .insert(liveSessions)
      .values({ organizationId, initiatedBy: "user", requestedByUserId: userId, status: "pending" })
      .returning({ id: liveSessions.id });

    await recordAudit(db, { actorUserId: userId, organizationId, action: "live_support.chamar" });
    return created;
  });

  log.info("live_support.chamar", { sessionId: session.id });
  await broadcast(adminSupportInboxChannelName(), "request", {
    sessionId: session.id,
    organizationId,
    organizationName,
  });

  return { ok: true, sessionId: session.id };
}

/** Usuário aceita um pedido que o admin abriu (startImpersonation-like, mas só a visão). */
export async function approveSupportSession(sessionId: string): Promise<ActionResult> {
  const { userId, organizationId, log, withDb } = await withOrg();

  const ok = await withDb(async (db) => {
    const [session] = await db
      .select()
      .from(liveSessions)
      .where(eq(liveSessions.id, sessionId))
      .limit(1);
    if (!session || session.organizationId !== organizationId || session.status !== "pending") {
      return false;
    }

    await db
      .update(liveSessions)
      .set({ status: "active", startedAt: new Date() })
      .where(eq(liveSessions.id, sessionId));

    await recordAudit(db, { actorUserId: userId, organizationId, action: "live_support.aprovar" });
    return true;
  });

  if (!ok) {
    return { ok: false, message: "Solicitação não encontrada ou já respondida." };
  }

  log.info("live_support.aprovar", { sessionId });
  await broadcast(liveSessionChannelName(sessionId), "status", { status: "active" });

  return { ok: true };
}

/** Usuário recusa um pedido que o admin abriu. */
export async function declineSupportSession(sessionId: string): Promise<ActionResult> {
  const { userId, organizationId, log, withDb } = await withOrg();

  const ok = await withDb(async (db) => {
    const [session] = await db
      .select()
      .from(liveSessions)
      .where(eq(liveSessions.id, sessionId))
      .limit(1);
    if (!session || session.organizationId !== organizationId || session.status !== "pending") {
      return false;
    }

    await db.update(liveSessions).set({ status: "declined" }).where(eq(liveSessions.id, sessionId));
    await recordAudit(db, { actorUserId: userId, organizationId, action: "live_support.recusar" });
    return true;
  });

  if (!ok) {
    return { ok: false, message: "Solicitação não encontrada ou já respondida." };
  }

  log.info("live_support.recusar", { sessionId });
  await broadcast(liveSessionChannelName(sessionId), "status", { status: "declined" });

  return { ok: true };
}

/** Admin aceita um pedido que o usuário abriu ("Chamar suporte"). */
export async function acceptSupportRequest(sessionId: string): Promise<ActionResult> {
  const { userId, log, withDb } = await requireAdmin();

  const organizationId = await withDb(async (db) => {
    const [session] = await db
      .select()
      .from(liveSessions)
      .where(eq(liveSessions.id, sessionId))
      .limit(1);
    if (!session || session.status !== "pending") return null;

    await db
      .update(liveSessions)
      .set({ adminUserId: userId, status: "active", startedAt: new Date() })
      .where(eq(liveSessions.id, sessionId));

    await recordAudit(db, {
      actorUserId: userId,
      organizationId: session.organizationId,
      action: "live_support.aceitar",
    });
    return session.organizationId;
  });

  if (!organizationId) {
    return { ok: false, message: "Solicitação não encontrada ou já respondida." };
  }

  log.warn("live_support.aceitar", { sessionId, organizationId });
  await broadcast(liveSessionChannelName(sessionId), "status", { status: "active" });

  revalidatePath(`/admin/organizacoes/${organizationId}`);
  revalidatePath("/admin");
  return { ok: true };
}

/** Concede/revoga controle de mouse/teclado durante uma sessão já ativa — sempre uma
 * decisão do usuário, nunca do admin. */
export async function setControlGranted(
  sessionId: string,
  granted: boolean,
): Promise<ActionResult> {
  const { userId, organizationId, log, withDb } = await withOrg();

  const ok = await withDb(async (db) => {
    const [session] = await db
      .select()
      .from(liveSessions)
      .where(eq(liveSessions.id, sessionId))
      .limit(1);
    if (!session || session.organizationId !== organizationId || session.status !== "active") {
      return false;
    }

    await db
      .update(liveSessions)
      .set({ controlGranted: granted })
      .where(eq(liveSessions.id, sessionId));

    await recordAudit(db, {
      actorUserId: userId,
      organizationId,
      action: granted ? "live_support.conceder_controle" : "live_support.revogar_controle",
    });
    return true;
  });

  if (!ok) {
    return { ok: false, message: "Sessão não encontrada ou não está ativa." };
  }

  log.info(granted ? "live_support.conceder_controle" : "live_support.revogar_controle", {
    sessionId,
  });
  await broadcast(liveSessionChannelName(sessionId), "control", { granted });

  return { ok: true };
}

/**
 * Salva o instantâneo completo mais recente para a sessão — chamado pelo
 * widget do usuário a cada `record()`/`takeFullSnapshot()`, com
 * `{ meta, snapshot }` (o evento Meta mais recente — que revela o iframe
 * do Replayer, ver live-session-viewer.tsx — junto do FullSnapshot em
 * si). Não passa pelo Broadcast: o DOM inteiro da tela gravada passa
 * fácil de 200KB, grande demais para uma mensagem de Realtime (que
 * aceita o envio mas descarta silenciosamente quando é grande demais). O
 * admin busca sob demanda (ver getFullSnapshot).
 */
export async function saveFullSnapshot(
  sessionId: string,
  snapshot: unknown,
): Promise<ActionResult> {
  const { organizationId, withDb } = await withOrg();

  const ok = await withDb(async (db) => {
    const [session] = await db
      .select({ id: liveSessions.id })
      .from(liveSessions)
      .where(
        and(
          eq(liveSessions.id, sessionId),
          eq(liveSessions.organizationId, organizationId),
          inArray(liveSessions.status, OPEN_STATUSES),
        ),
      )
      .limit(1);
    if (!session) return false;

    await db
      .update(liveSessions)
      .set({ lastFullSnapshot: snapshot })
      .where(eq(liveSessions.id, sessionId));
    return true;
  });

  if (!ok) {
    return { ok: false, message: "Sessão não encontrada ou não está ativa." };
  }

  return { ok: true };
}

interface SnapshotResult extends ActionResult {
  snapshot?: unknown;
}

/** Busca o instantâneo completo mais recente — chamado pelo LiveSessionViewer do admin ao montar/reconectar. */
export async function getFullSnapshot(sessionId: string): Promise<SnapshotResult> {
  const { withDb } = await requireAdmin();

  const session = await withDb(async (db) => {
    const [row] = await db
      .select({ lastFullSnapshot: liveSessions.lastFullSnapshot })
      .from(liveSessions)
      .where(eq(liveSessions.id, sessionId))
      .limit(1);
    return row ?? null;
  });

  if (!session) {
    return { ok: false, message: "Sessão não encontrada." };
  }

  return { ok: true, snapshot: session.lastFullSnapshot };
}

/**
 * Encerra a sessão — de qualquer um dos dois lados: quem pediu, o admin
 * que está nela, qualquer platform admin (rede de segurança) ou qualquer
 * membro daquela organização.
 *
 * Usa `runWithUserContext` diretamente (não `withOrg()`/`requireAdmin()`)
 * de propósito: `withOrg()` lançaria `OrganizationBlockedError` se a
 * organização estiver bloqueada, mas encerrar uma sessão de suporte
 * precisa continuar funcionando mesmo nesse caso. A RLS de `live_sessions`
 * (apply_org_rls) já escopa o que esta consulta enxerga pela organização
 * do usuário — ou por inteiro, se ele for platform admin.
 */
export async function endLiveSession(sessionId: string): Promise<ActionResult> {
  const user = await getSession();
  if (!user) return { ok: false, message: "Não autenticado." };

  const result = await runWithUserContext(user.id, async (db) => {
    const [session] = await db
      .select()
      .from(liveSessions)
      .where(eq(liveSessions.id, sessionId))
      .limit(1);
    if (!session) return { ok: false as const, message: "Sessão não encontrada." };
    if (session.status === "ended") return { ok: true as const, session };

    const [membership] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, user.id),
          eq(memberships.organizationId, session.organizationId),
        ),
      )
      .limit(1);

    const allowed =
      user.id === session.requestedByUserId ||
      user.id === session.adminUserId ||
      Boolean(membership) ||
      (await isPlatformAdmin(user.id));

    if (!allowed) {
      return { ok: false as const, message: "Sem permissão para encerrar esta sessão." };
    }

    await db
      .update(liveSessions)
      .set({ status: "ended", endedAt: new Date(), controlGranted: false })
      .where(eq(liveSessions.id, sessionId));

    await recordAudit(db, {
      actorUserId: user.id,
      organizationId: session.organizationId,
      action: "live_support.encerrar",
    });

    return { ok: true as const, session };
  });

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  await broadcast(liveSessionChannelName(sessionId), "status", { status: "ended" });

  const organizationId = result.session.organizationId;
  const orgExists = await runWithUserContext(user.id, async (db) => {
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    return Boolean(org);
  });
  if (orgExists) {
    revalidatePath(`/admin/organizacoes/${organizationId}`);
  }
  revalidatePath("/admin");

  return { ok: true };
}

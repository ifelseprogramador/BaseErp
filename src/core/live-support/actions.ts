"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { withOrg, getSession } from "@/core/auth";
import { requireAdmin } from "@/core/admin-auth";
import { isPlatformAdmin } from "@/core/platform-admin";
import { runWithUserContext, type Database } from "@/core/db";
import {
  liveSessionMessages,
  liveSessions,
  memberships,
  organizations,
  platformAdmins,
} from "@/db/schema";
import { recordAudit } from "@/core/admin/audit";
import { expireStalePendingSessions } from "./queries";
import { sendBroadcast as broadcast } from "@/core/supabase/realtime-sender";
import {
  getTelegramWebhookInfo,
  sendTelegramMessageDetailed,
  setTelegramWebhook,
} from "@/core/telegram";
import { announceScreenStarted, forwardUserMessage, sendToOwner } from "./telegram-bridge";
import type { ActionResult } from "@/core/action-result";
import {
  adminSupportInboxChannelName,
  liveSessionChannelName,
  userSupportChannelName,
} from "./realtime";
import {
  ADMIN_ONLINE_WINDOW_SECONDS,
  DEFAULT_SUPPORT_WAIT_SECONDS,
  clampWaitSeconds,
  computeAdminRequestExpiresAt,
  computeExpiresAt,
  formatSupportAlert,
  isRequestExpired,
  normalizeChatMessage,
} from "./wait";

const OPEN_STATUSES = ["pending", "active", "chat"] as const;

interface SessionActionResult extends ActionResult {
  sessionId?: string;
}

/**
 * Suporte ao vivo — modelo atual (ver docs/decisoes.md, "Suporte ao vivo por
 * pessoa, espera configurável e chat"):
 *
 * - A sessão é de UMA PESSOA (`subjectUserId`): só o widget dela entra, só ela
 *   vê/encerra (RLS), e o controle remoto vale só na tela dela. Antes era da
 *   organização inteira.
 * - "Chamar suporte": se há alguém do suporte online (presença do painel
 *   /admin), o pedido espera `support_wait_seconds`; se ninguém aceita, ou se
 *   ninguém está online, vira `missed`, o dono é avisado no Telegram e o
 *   pedido fica no painel /admin para ele pedir acesso à tela quando entrar —
 *   e a pessoa precisa aprovar de novo (pode ter sido horas atrás).
 * - Enquanto ativa, os dois lados trocam mensagens de texto (chat).
 */

/** Pergunta ao banco se algum admin bateu presença recentemente (função
 * SECURITY DEFINER: o usuário comum não lê `platform_admins`). */
async function isAnyAdminOnline(db: Database): Promise<boolean> {
  const [row] = await db.execute<{ online: boolean }>(
    sql`select public.any_platform_admin_online(${ADMIN_ONLINE_WINDOW_SECONDS}) as online`,
  );
  return Boolean(row?.online);
}

/** Espera por atendimento DESTA organização (`organizations.support_wait_seconds`). */
async function getWaitSeconds(db: Database, organizationId: string): Promise<number> {
  const [row] = await db
    .select({ seconds: organizations.supportWaitSeconds })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return clampWaitSeconds(row?.seconds ?? DEFAULT_SUPPORT_WAIT_SECONDS);
}

function siteOrigin(): string | undefined {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return configured ? configured.replace(/\/+$/, "") : undefined;
}

/** Avisa o dono da plataforma de um pedido sem atendimento: Telegram +
 * painel em tempo real (se alguém estiver com ele aberto). Melhor esforço. */
async function alertMissedRequest(input: {
  sessionId: string;
  organizationId: string;
  organizationName: string;
  userName: string;
  subjectUserId: string;
}) {
  const origin = siteOrigin();
  // `sendToOwner` guarda o id da mensagem do Telegram: é por ele que a RESPOSTA
  // do dono ("Responder" no alerta) volta para esta sessão.
  await sendToOwner(
    input.sessionId,
    formatSupportAlert({
      userName: input.userName,
      organizationName: input.organizationName,
      adminUrl: origin ? `${origin}/admin` : undefined,
    }),
  );
  await broadcast(adminSupportInboxChannelName(), "missed", {
    sessionId: input.sessionId,
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    userName: input.userName,
    subjectUserId: input.subjectUserId,
  });
}

/** Admin pede acesso à tela de UMA pessoa de uma organização. Ver core/admin/components/live-support-card.tsx. */
export async function requestSupportAccess(
  organizationId: string,
  subjectUserId: string,
): Promise<SessionActionResult> {
  const { userId, log, withDb } = await requireAdmin();

  const result = await withDb(async (db) => {
    await expireStalePendingSessions(db);
    const [member] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.organizationId, organizationId),
          eq(memberships.userId, subjectUserId),
          eq(memberships.active, true),
        ),
      )
      .limit(1);
    if (!member) return "not_member" as const;

    const [existing] = await db
      .select({ id: liveSessions.id })
      .from(liveSessions)
      .where(
        and(
          eq(liveSessions.subjectUserId, subjectUserId),
          inArray(liveSessions.status, OPEN_STATUSES),
        ),
      )
      .limit(1);
    if (existing) return "exists" as const;

    const [session] = await db
      .insert(liveSessions)
      .values({
        organizationId,
        initiatedBy: "admin",
        adminUserId: userId,
        subjectUserId,
        status: "pending",
        expiresAt: computeAdminRequestExpiresAt(new Date()),
      })
      .returning({ id: liveSessions.id });

    await recordAudit(db, {
      actorUserId: userId,
      organizationId,
      action: "live_support.solicitar",
      metadata: { subjectUserId },
    });
    return session;
  });

  if (result === "not_member") {
    return { ok: false, message: "Esta pessoa não está ativa nesta organização." };
  }
  if (result === "exists") {
    return { ok: false, message: "Já existe uma sessão de suporte em aberto para esta pessoa." };
  }

  log.warn("live_support.solicitar", { organizationId, sessionId: result.id });
  await broadcast(userSupportChannelName(subjectUserId), "request", { sessionId: result.id });

  revalidatePath(`/admin/organizacoes/${organizationId}`);
  return { ok: true, sessionId: result.id };
}

export interface CallForSupportResult extends SessionActionResult {
  /** `pending` = esperando atendimento; `missed` = ninguém online agora. */
  status?: "pending" | "active" | "missed" | "chat";
  /** Segundos de espera (só quando `pending`). */
  waitSeconds?: number;
  /** ISO do fim da espera (só quando `pending`). */
  expiresAt?: string;
}

/** Usuário chama o suporte. Botão em (app), ver live-support-widget.tsx. */
export async function callForSupport(): Promise<CallForSupportResult> {
  const ctx = await withOrg();
  if (ctx.impersonating) {
    return { ok: false, message: "Indisponível em modo suporte." };
  }
  const { userId, organizationId, log, withDb } = ctx;

  const user = await getSession();
  const userName =
    (user?.user_metadata?.display_name as string | undefined) ?? user?.email ?? "Alguém";

  const outcome = await withDb(async (db) => {
    await expireStalePendingSessions(db);
    const [org] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    const organizationName = org?.name ?? "Organização";

    // Já tem pedido aberto desta pessoa: devolve em vez de criar outro.
    const [existing] = await db
      .select({
        id: liveSessions.id,
        status: liveSessions.status,
        expiresAt: liveSessions.expiresAt,
      })
      .from(liveSessions)
      .where(
        and(eq(liveSessions.subjectUserId, userId), inArray(liveSessions.status, OPEN_STATUSES)),
      )
      .limit(1);
    if (existing) {
      return { kind: "existing" as const, existing, organizationName };
    }

    // Pedido "perdido" há poucos minutos: não cria outro nem manda outro
    // Telegram (a pessoa só clicou de novo).
    const [recentMissed] = await db
      .select({ id: liveSessions.id })
      .from(liveSessions)
      .where(
        and(
          eq(liveSessions.subjectUserId, userId),
          eq(liveSessions.status, "missed"),
          sql`${liveSessions.createdAt} > now() - interval '5 minutes'`,
        ),
      )
      .limit(1);
    if (recentMissed) {
      return { kind: "recent_missed" as const, id: recentMissed.id, organizationName };
    }

    const online = await isAnyAdminOnline(db);
    const waitSeconds = await getWaitSeconds(db, organizationId);
    const expiresAt = online ? computeExpiresAt(new Date(), waitSeconds) : null;

    const [created] = await db
      .insert(liveSessions)
      .values({
        organizationId,
        initiatedBy: "user",
        requestedByUserId: userId,
        subjectUserId: userId,
        status: online ? "pending" : "missed",
        expiresAt,
      })
      .returning({ id: liveSessions.id });

    await recordAudit(db, { actorUserId: userId, organizationId, action: "live_support.chamar" });
    return {
      kind: "created" as const,
      id: created.id,
      online,
      waitSeconds,
      expiresAt,
      organizationName,
    };
  });

  if (outcome.kind === "existing") {
    log.info("live_support.chamar.existente", { sessionId: outcome.existing.id });
    return {
      ok: true,
      sessionId: outcome.existing.id,
      status: outcome.existing.status as "pending" | "active" | "chat",
      expiresAt: outcome.existing.expiresAt?.toISOString(),
    };
  }
  if (outcome.kind === "recent_missed") {
    return { ok: true, sessionId: outcome.id, status: "missed" };
  }

  log.info("live_support.chamar", { sessionId: outcome.id, online: outcome.online });

  if (outcome.online) {
    await broadcast(adminSupportInboxChannelName(), "request", {
      sessionId: outcome.id,
      organizationId,
      organizationName: outcome.organizationName,
      userName,
      subjectUserId: userId,
    });
    return {
      ok: true,
      sessionId: outcome.id,
      status: "pending",
      waitSeconds: outcome.waitSeconds,
      expiresAt: outcome.expiresAt?.toISOString(),
    };
  }

  // Ninguém online: já nasce "perdida" — avisa o dono no Telegram.
  await alertMissedRequest({
    sessionId: outcome.id,
    organizationId,
    organizationName: outcome.organizationName,
    userName,
    subjectUserId: userId,
  });
  return { ok: true, sessionId: outcome.id, status: "missed" };
}

/**
 * Chamado pelo navegador de quem pediu quando a contagem acaba sem
 * atendimento. Quem decide é o SERVIDOR (confere `expires_at`): se já foi
 * aceito, devolve o status real; se venceu, marca `missed` e avisa o dono.
 */
export async function expireSupportRequest(
  sessionId: string,
): Promise<ActionResult & { status?: string }> {
  const { userId, organizationId, log, withDb } = await withOrg();

  const outcome = await withDb(async (db) => {
    const [session] = await db
      .select()
      .from(liveSessions)
      .where(eq(liveSessions.id, sessionId))
      .limit(1);
    if (!session || session.subjectUserId !== userId) return { kind: "not_found" as const };
    if (session.status !== "pending" || session.initiatedBy !== "user") {
      return { kind: "unchanged" as const, status: session.status };
    }
    if (!isRequestExpired(session.expiresAt, new Date())) {
      return { kind: "unchanged" as const, status: session.status };
    }

    // `where status = 'pending'`: se o admin aceitou no mesmo instante, não
    // sobrescreve (e o aviso só sai se ESTA chamada fez a troca).
    const updated = await db
      .update(liveSessions)
      .set({ status: "missed" })
      .where(and(eq(liveSessions.id, sessionId), eq(liveSessions.status, "pending")))
      .returning({ id: liveSessions.id });
    if (updated.length === 0) return { kind: "unchanged" as const, status: "active" };

    const [org] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    return { kind: "missed" as const, organizationName: org?.name ?? "Organização" };
  });

  if (outcome.kind === "not_found") return { ok: false, message: "Pedido não encontrado." };
  if (outcome.kind === "unchanged") return { ok: true, status: outcome.status };

  const user = await getSession();
  const userName =
    (user?.user_metadata?.display_name as string | undefined) ?? user?.email ?? "Alguém";
  log.warn("live_support.sem_atendimento", { sessionId });
  await alertMissedRequest({
    sessionId,
    organizationId,
    organizationName: outcome.organizationName,
    userName,
    subjectUserId: userId,
  });
  return { ok: true, status: "missed" };
}

/**
 * Admin entra depois e pede para ver a tela de quem tinha pedido ajuda
 * (pedido `missed`). Reabre a MESMA sessão como pedido do admin: o aviso
 * "Suporte quer ver sua tela" aparece só para aquela pessoa (agora, ou no
 * próximo acesso dela) e ela decide.
 */
export async function requestAccessToSession(sessionId: string): Promise<SessionActionResult> {
  const { userId, log, withDb } = await requireAdmin();

  const result = await withDb(async (db) => {
    const [session] = await db
      .select()
      .from(liveSessions)
      .where(eq(liveSessions.id, sessionId))
      .limit(1);
    if (!session || !session.subjectUserId) return null;

    // Conversa por texto em andamento (veio do Telegram): NÃO fecha a conversa;
    // só marca que o suporte quer ver a tela — a caixa da pessoa mostra o
    // aviso de consentimento e, se ela aprovar, a MESMA sessão vira `active`
    // com o mesmo histórico de mensagens.
    if (session.status === "chat") {
      if (session.screenRequested) return { session, fromChat: true as const };
      await db
        .update(liveSessions)
        .set({ screenRequested: true, adminUserId: userId })
        .where(eq(liveSessions.id, sessionId));
      await recordAudit(db, {
        actorUserId: userId,
        organizationId: session.organizationId,
        action: "live_support.solicitar_tela_na_conversa",
        metadata: { sessionId, subjectUserId: session.subjectUserId },
      });
      return { session, fromChat: true as const };
    }

    if (session.status !== "missed") return null;

    // Não abre se a pessoa já tem outra sessão aberta.
    const [other] = await db
      .select({ id: liveSessions.id })
      .from(liveSessions)
      .where(
        and(
          eq(liveSessions.subjectUserId, session.subjectUserId),
          inArray(liveSessions.status, OPEN_STATUSES),
        ),
      )
      .limit(1);
    if (other) return null;

    await db
      .update(liveSessions)
      .set({
        status: "pending",
        initiatedBy: "admin",
        adminUserId: userId,
        expiresAt: computeAdminRequestExpiresAt(new Date()),
      })
      .where(eq(liveSessions.id, sessionId));

    await recordAudit(db, {
      actorUserId: userId,
      organizationId: session.organizationId,
      action: "live_support.solicitar_apos_pedido",
      metadata: { sessionId, subjectUserId: session.subjectUserId },
    });
    return { session, fromChat: false as const };
  });

  if (!result || !result.session.subjectUserId) {
    return {
      ok: false,
      message: "Pedido não encontrado, já respondido ou pessoa com outra sessão aberta.",
    };
  }
  const { session: opened, fromChat } = result;

  log.warn("live_support.solicitar_apos_pedido", { sessionId, fromChat });
  if (fromChat) {
    // A pessoa já está na conversa: o aviso chega pelo canal da própria sessão.
    await broadcast(liveSessionChannelName(sessionId), "screen-request", {});
  } else {
    await broadcast(userSupportChannelName(opened.subjectUserId as string), "request", {
      sessionId,
    });
  }

  revalidatePath(`/admin/organizacoes/${opened.organizationId}`);
  revalidatePath("/admin");
  return { ok: true, sessionId };
}

/** Pessoa aceita um pedido que o admin abriu (só a visão; controle é outra etapa). */
export async function approveSupportSession(sessionId: string): Promise<ActionResult> {
  const { userId, organizationId, log, withDb } = await withOrg();

  const ok = await withDb(async (db) => {
    const [session] = await db
      .select()
      .from(liveSessions)
      .where(eq(liveSessions.id, sessionId))
      .limit(1);
    if (
      !session ||
      session.organizationId !== organizationId ||
      session.subjectUserId !== userId ||
      !(session.status === "pending" || (session.status === "chat" && session.screenRequested))
    ) {
      return false;
    }

    const fromChat = session.status === "chat";
    await db
      .update(liveSessions)
      .set({ status: "active", startedAt: new Date(), screenRequested: false })
      .where(eq(liveSessions.id, sessionId));

    await recordAudit(db, { actorUserId: userId, organizationId, action: "live_support.aprovar" });
    return { fromChat };
  });

  if (!ok) {
    return { ok: false, message: "Solicitação não encontrada ou já respondida." };
  }

  log.info("live_support.aprovar", { sessionId });
  await broadcast(liveSessionChannelName(sessionId), "status", { status: "active" });

  // Veio de uma conversa que passava pelo Telegram: avisa o dono de que ela
  // mudou para o painel (a pessoa não percebe nada — é a mesma caixa).
  if (ok.fromChat) {
    const user = await getSession();
    const [org] = await withDb((db) =>
      db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1),
    );
    await announceScreenStarted({
      sessionId,
      userName:
        (user?.user_metadata?.display_name as string | undefined) ?? user?.email ?? "O usuário",
      organizationName: org?.name ?? "Organização",
    });
  }

  return { ok: true };
}

/** Pessoa recusa um pedido que o admin abriu. */
export async function declineSupportSession(sessionId: string): Promise<ActionResult> {
  const { userId, organizationId, log, withDb } = await withOrg();

  const ok = await withDb(async (db) => {
    const [session] = await db
      .select()
      .from(liveSessions)
      .where(eq(liveSessions.id, sessionId))
      .limit(1);
    if (
      !session ||
      session.organizationId !== organizationId ||
      session.subjectUserId !== userId ||
      !(session.status === "pending" || (session.status === "chat" && session.screenRequested))
    ) {
      return false;
    }

    // Numa conversa por texto, recusar a TELA não encerra a conversa.
    const fromChat = session.status === "chat";
    if (fromChat) {
      await db
        .update(liveSessions)
        .set({ screenRequested: false })
        .where(eq(liveSessions.id, sessionId));
    } else {
      await db
        .update(liveSessions)
        .set({ status: "declined" })
        .where(eq(liveSessions.id, sessionId));
    }
    await recordAudit(db, { actorUserId: userId, organizationId, action: "live_support.recusar" });
    return { fromChat };
  });

  if (!ok) {
    return { ok: false, message: "Solicitação não encontrada ou já respondida." };
  }

  log.info("live_support.recusar", { sessionId });
  await broadcast(liveSessionChannelName(sessionId), "status", {
    status: ok.fromChat ? "chat" : "declined",
  });

  return { ok: true };
}

/** Admin atende um pedido que a pessoa abriu ("Chamar suporte") e ainda está esperando. */
export async function acceptSupportRequest(sessionId: string): Promise<ActionResult> {
  const { userId, log, withDb } = await requireAdmin();

  const organizationId = await withDb(async (db) => {
    const [session] = await db
      .select()
      .from(liveSessions)
      .where(eq(liveSessions.id, sessionId))
      .limit(1);
    if (!session || session.status !== "pending" || session.initiatedBy !== "user") return null;

    await db
      .update(liveSessions)
      .set({ adminUserId: userId, status: "active", startedAt: new Date(), expiresAt: null })
      .where(eq(liveSessions.id, sessionId));

    await recordAudit(db, {
      actorUserId: userId,
      organizationId: session.organizationId,
      action: "live_support.aceitar",
    });
    return session.organizationId;
  });

  if (!organizationId) {
    return { ok: false, message: "Solicitação não encontrada, já atendida ou expirada." };
  }

  log.warn("live_support.aceitar", { sessionId, organizationId });
  await broadcast(liveSessionChannelName(sessionId), "status", { status: "active" });

  revalidatePath(`/admin/organizacoes/${organizationId}`);
  revalidatePath("/admin");
  return { ok: true };
}

/** Concede/revoga controle de mouse/teclado durante uma sessão já ativa — sempre uma
 * decisão da pessoa, nunca do admin. */
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
    if (
      !session ||
      session.organizationId !== organizationId ||
      session.subjectUserId !== userId ||
      session.status !== "active"
    ) {
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
 * widget da pessoa a cada `record()`/`takeFullSnapshot()`, com
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
  const { userId, organizationId, withDb } = await withOrg();

  const ok = await withDb(async (db) => {
    const [session] = await db
      .select({ id: liveSessions.id })
      .from(liveSessions)
      .where(
        and(
          eq(liveSessions.id, sessionId),
          eq(liveSessions.organizationId, organizationId),
          eq(liveSessions.subjectUserId, userId),
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
 * Encerra a sessão — de qualquer um dos dois lados: a pessoa dela ou
 * qualquer platform admin (a RLS de `live_sessions` só deixa essas duas
 * enxergarem/alterarem a linha; colega da mesma empresa não encerra a
 * sessão do outro).
 *
 * Usa `runWithUserContext` diretamente (não `withOrg()`/`requireAdmin()`)
 * de propósito: `withOrg()` lançaria `OrganizationBlockedError` se a
 * organização estiver bloqueada, mas encerrar uma sessão de suporte
 * precisa continuar funcionando mesmo nesse caso.
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

    const allowed = user.id === session.subjectUserId || (await isPlatformAdmin(user.id));

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

  // Conversa por texto encerrada pela PESSOA: o dono, que a acompanha pelo
  // Telegram, precisa saber que acabou (não há outra tela dele mostrando isso).
  if (result.session.status === "chat" && user.id === result.session.subjectUserId) {
    await sendToOwner(
      sessionId,
      `🔚 ${(user.user_metadata?.display_name as string | undefined) ?? user.email ?? "O usuário"} encerrou a conversa.`,
    );
  }

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

export interface ChatMessageDto {
  id: string;
  role: "admin" | "user";
  body: string;
  createdAt: string;
}

function toDto(row: {
  id: string;
  senderRole: "admin" | "user";
  body: string;
  createdAt: Date;
}): ChatMessageDto {
  return {
    id: row.id,
    role: row.senderRole,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Envia uma mensagem do chat da sessão. Quem é "user" × "admin" vem do
 * servidor (a pessoa da sessão × um platform admin), nunca do cliente; a
 * RLS ainda confere que a sessão está ativa e que a pessoa participa dela.
 */
export async function sendSupportMessage(
  sessionId: string,
  rawBody: string,
): Promise<ActionResult & { chatMessage?: ChatMessageDto }> {
  const user = await getSession();
  if (!user) return { ok: false, message: "Não autenticado." };

  const body = normalizeChatMessage(rawBody);
  if (!body) return { ok: false, message: "Escreva uma mensagem." };

  const outcome = await runWithUserContext(user.id, async (db) => {
    const [session] = await db
      .select()
      .from(liveSessions)
      .where(eq(liveSessions.id, sessionId))
      .limit(1);
    if (!session || !(session.status === "active" || session.status === "chat")) return null;

    const role: "admin" | "user" | null =
      session.subjectUserId === user.id
        ? "user"
        : (await isPlatformAdmin(user.id))
          ? "admin"
          : null;
    if (!role) return null;

    const [row] = await db
      .insert(liveSessionMessages)
      .values({
        sessionId,
        organizationId: session.organizationId,
        senderUserId: user.id,
        senderRole: role,
        body,
      })
      .returning();
    return { row, status: session.status, organizationId: session.organizationId, role };
  });

  if (!outcome) {
    return { ok: false, message: "Não foi possível enviar: a conversa não está aberta." };
  }

  const message = toDto(outcome.row);
  // Só avisa o outro lado; a mensagem em si já está gravada e a tela dele a
  // adiciona direto do payload (pequeno), sem reler tudo.
  await broadcast(liveSessionChannelName(sessionId), "message", message);

  // Conversa só por texto (veio do Telegram): o que a PESSOA escreve chega ao
  // Telegram do dono. Com a tela compartilhada (`active`) a conversa já é no
  // painel e nada vai ao Telegram.
  if (outcome.status === "chat" && outcome.role === "user") {
    const org = await runWithUserContext(user.id, async (db) => {
      const [row] = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, outcome.organizationId))
        .limit(1);
      return row;
    });
    await forwardUserMessage({
      sessionId,
      userName: (user.user_metadata?.display_name as string | undefined) ?? user.email ?? "Usuário",
      organizationName: org?.name ?? "Organização",
      body: message.body,
    });
  }
  return { ok: true, chatMessage: message };
}

/** Histórico do chat da sessão (a RLS limita a quem participa). */
export async function listSupportMessages(
  sessionId: string,
): Promise<ActionResult & { messages?: ChatMessageDto[] }> {
  const user = await getSession();
  if (!user) return { ok: false, message: "Não autenticado." };

  const rows = await runWithUserContext(user.id, (db) =>
    db
      .select()
      .from(liveSessionMessages)
      .where(eq(liveSessionMessages.sessionId, sessionId))
      .orderBy(asc(liveSessionMessages.createdAt)),
  );
  return { ok: true, messages: rows.map(toDto) };
}

/**
 * Batida de presença do painel `/admin` (a cada ~20 s, ver
 * `core/admin/components/admin-presence-beacon.tsx`). É isto que o "Chamar
 * suporte" consulta para saber se há alguém online.
 */
export async function adminHeartbeat(): Promise<ActionResult> {
  const { userId, withDb } = await requireAdmin();
  await withDb((db) =>
    db
      .update(platformAdmins)
      .set({ lastSeenAt: new Date() })
      .where(eq(platformAdmins.userId, userId)),
  );
  return { ok: true };
}

/**
 * Quanto os usuários DESTA organização esperam por atendimento antes de o
 * pedido virar "sem atendimento" e o Telegram avisar (5–300 s). Por
 * organização, não global — o dono da plataforma combina um prazo com cada
 * cliente.
 */
export async function updateSupportWaitSeconds(
  organizationId: string,
  seconds: number,
): Promise<ActionResult> {
  const { userId, log, withDb } = await requireAdmin();
  const value = clampWaitSeconds(seconds);

  const updated = await withDb(async (db) => {
    const rows = await db
      .update(organizations)
      .set({ supportWaitSeconds: value, updatedAt: new Date() })
      .where(eq(organizations.id, organizationId))
      .returning({ id: organizations.id });
    if (rows.length === 0) return false;
    await recordAudit(db, {
      actorUserId: userId,
      organizationId,
      action: "organizacao.suporte_espera",
      metadata: { seconds: value },
    });
    return true;
  });
  if (!updated) return { ok: false, message: "Organização não encontrada." };

  log.info("admin.suporte.espera", { organizationId, seconds: value });
  revalidatePath(`/admin/organizacoes/${organizationId}`);
  return { ok: true, message: undefined };
}

/**
 * Botão "Enviar mensagem de teste" do `/admin`: confirma que o token e o chat
 * id das variáveis de ambiente funcionam, e diz o que está errado quando não.
 */
export async function sendTelegramTest(): Promise<ActionResult> {
  const { log } = await requireAdmin();
  const result = await sendTelegramMessageDetailed(
    "✅ Teste do suporte: este chat vai receber o aviso quando alguém pedir ajuda e você não estiver online.",
  );
  if (result.ok) {
    log.info("admin.telegram.teste_ok");
    return { ok: true };
  }
  const messages = {
    not_configured:
      "Faltam TELEGRAM_BOT_TOKEN e/ou TELEGRAM_CHAT_ID nas variáveis de ambiente (e reinicie o servidor depois de editar o .env.local).",
    rejected: `O Telegram recusou${result.detail ? `: ${result.detail}` : ""}. Confira o token e o chat id — e lembre de mandar uma mensagem para o bot antes (ele só fala com quem já falou com ele).`,
    network: "Não foi possível falar com o Telegram agora. Tente de novo em instantes.",
  } as const;
  return { ok: false, message: messages[result.reason] };
}

/**
 * Registra o webhook do bot para as respostas do dono chegarem à nossa rota
 * (`/api/telegram/webhook`). Exige `NEXT_PUBLIC_SITE_URL` pública (HTTPS — o
 * Telegram não alcança `localhost`) e `TELEGRAM_WEBHOOK_SECRET`.
 */
export async function registerTelegramWebhook(): Promise<ActionResult> {
  const { log } = await requireAdmin();
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const origin = siteOrigin();
  if (!secret) {
    return {
      ok: false,
      message:
        "Defina TELEGRAM_WEBHOOK_SECRET nas variáveis de ambiente (uma senha longa e aleatória).",
    };
  }
  if (!origin || !origin.startsWith("https://")) {
    return {
      ok: false,
      message:
        "Defina NEXT_PUBLIC_SITE_URL com o endereço público HTTPS do sistema (em teste local, use um túnel como o ngrok) — o Telegram não alcança localhost.",
    };
  }
  const result = await setTelegramWebhook(`${origin}/api/telegram/webhook`, secret);
  if (!result.ok) {
    log.warn("admin.telegram.webhook_falhou", { reason: result.reason });
    return {
      ok: false,
      message:
        result.reason === "not_configured"
          ? "Faltam TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID."
          : `O Telegram recusou${result.detail ? `: ${result.detail}` : ""}.`,
    };
  }
  log.info("admin.telegram.webhook_registrado");
  return { ok: true };
}

export interface TelegramWebhookStatus extends ActionResult {
  url?: string;
  pendingUpdateCount?: number;
  lastErrorMessage?: string;
  /** O endereço registrado é o esperado para este sistema? */
  matchesThisSite?: boolean;
}

/** Estado atual do webhook no Telegram (para o card do `/admin`). */
export async function getTelegramWebhookStatus(): Promise<TelegramWebhookStatus> {
  await requireAdmin();
  const result = await getTelegramWebhookInfo();
  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "not_configured"
          ? "Faltam TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID."
          : "Não foi possível consultar o Telegram agora.",
    };
  }
  const origin = siteOrigin();
  return {
    ok: true,
    url: result.info.url,
    pendingUpdateCount: result.info.pendingUpdateCount,
    lastErrorMessage: result.info.lastErrorMessage,
    matchesThisSite: Boolean(origin) && result.info.url === `${origin}/api/telegram/webhook`,
  };
}

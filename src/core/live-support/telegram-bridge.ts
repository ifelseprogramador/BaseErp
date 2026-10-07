import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { runWithSystemContext, runWithUserContext, type Database } from "@/core/db";
import { liveSessions, organizations, platformAdmins, supportTelegramMessages } from "@/db/schema";
import { recordAudit } from "@/core/admin/audit";
import { logger } from "@/core/logger";
import { sendBroadcast as broadcast } from "@/core/supabase/realtime-sender";
import { sendTelegramMessageDetailed } from "@/core/telegram";
import { getUserDisplayInfoByIds } from "@/core/user-lookup";
import { announceAdminChatMessage, postAdminChatMessage } from "./chat-service";
import { liveSessionChannelName } from "./realtime";
import {
  formatConversationOpened,
  formatForwardedMessage,
  formatScreenStarted,
  parseOwnerCommand,
  planOwnerReply,
  type TelegramInbound,
} from "./telegram-update";
import { normalizeChatMessage } from "./wait";

/**
 * Ponte entre o Telegram do dono e a caixa de conversa do suporte. Quem decide
 * o que é conversa é a SESSÃO (`live_sessions`):
 *
 *   missed ──(dono responde no Telegram)──▶ chat ──(a pessoa aprova ver a
 *   tela)──▶ active
 *
 * Em `chat` a conversa é só texto e passa pelo Telegram nos dois sentidos; ao
 * virar `active` (tela compartilhada) ela CONTINUA no mesmo histórico, só que
 * agora pelo painel — o Telegram recebe um aviso e deixa de ser o canal. A
 * pessoa vê sempre a mesma caixa de conversa.
 */

export function adminPanelUrl(): string | undefined {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  return origin ? `${origin}/admin` : undefined;
}

/** Guarda "esta mensagem do Telegram pertence a esta sessão" (também serve de
 * trava contra o Telegram reenviando o mesmo update: a chave primária recusa). */
export async function rememberTelegramMessage(
  sessionId: string,
  telegramMessageId: number,
): Promise<boolean> {
  const rows = await runWithSystemContext((db) =>
    db
      .insert(supportTelegramMessages)
      .values({ telegramMessageId, sessionId })
      .onConflictDoNothing()
      .returning({ id: supportTelegramMessages.telegramMessageId }),
  );
  return rows.length > 0;
}

/** Envia ao Telegram do dono uma mensagem ligada à sessão (a resposta dele volta para ela). */
export async function sendToOwner(sessionId: string, text: string) {
  const result = await sendTelegramMessageDetailed(text);
  if (result.ok && result.messageId) {
    await rememberTelegramMessage(sessionId, result.messageId);
  }
  return result;
}

/** A pessoa escreveu numa conversa só de texto: o dono recebe no Telegram. */
export async function forwardUserMessage(input: {
  sessionId: string;
  userName: string;
  organizationName: string;
  body: string;
}) {
  await sendToOwner(input.sessionId, formatForwardedMessage(input));
}

/** A tela começou a ser compartilhada: avisa que a conversa mudou para o painel. */
export async function announceScreenStarted(input: {
  sessionId: string;
  userName: string;
  organizationName: string;
}) {
  await sendToOwner(input.sessionId, formatScreenStarted({ ...input, adminUrl: adminPanelUrl() }));
}

async function resolveAdminUserId(): Promise<string | null> {
  const configured = process.env.TELEGRAM_ADMIN_USER_ID?.trim();
  if (configured) return configured;
  const [row] = await runWithSystemContext((db) =>
    db
      .select({ userId: platformAdmins.userId })
      .from(platformAdmins)
      .orderBy(asc(platformAdmins.createdAt))
      .limit(1),
  );
  return row?.userId ?? null;
}

interface TargetSession {
  id: string;
  organizationId: string;
  organizationName: string;
  subjectUserId: string | null;
  status: string;
  initiatedBy: "admin" | "user";
}

const REPLYABLE = ["missed", "pending", "chat"] as const;

type Lookup =
  | { kind: "found"; session: TargetSession }
  | { kind: "none" }
  | { kind: "ambiguous"; count: number };

/** Qual sessão a resposta do dono se refere: a da mensagem respondida, ou a
 * única conversa em aberto. Com mais de uma e sem "Responder", pede para escolher. */
async function findTarget(db: Database, replyToMessageId: number | null): Promise<Lookup> {
  const columns = {
    id: liveSessions.id,
    organizationId: liveSessions.organizationId,
    organizationName: organizations.name,
    subjectUserId: liveSessions.subjectUserId,
    status: liveSessions.status,
    initiatedBy: liveSessions.initiatedBy,
  };

  if (replyToMessageId !== null) {
    const [mapped] = await db
      .select(columns)
      .from(supportTelegramMessages)
      .innerJoin(liveSessions, eq(liveSessions.id, supportTelegramMessages.sessionId))
      .innerJoin(organizations, eq(organizations.id, liveSessions.organizationId))
      .where(eq(supportTelegramMessages.telegramMessageId, replyToMessageId))
      .limit(1);
    if (mapped) return { kind: "found", session: mapped };
  }

  const candidates = await db
    .select(columns)
    .from(liveSessions)
    .innerJoin(organizations, eq(organizations.id, liveSessions.organizationId))
    .where(and(eq(liveSessions.initiatedBy, "user"), inArray(liveSessions.status, [...REPLYABLE])))
    .orderBy(desc(liveSessions.createdAt))
    .limit(5);
  if (candidates.length === 0) return { kind: "none" };
  if (candidates.length > 1) return { kind: "ambiguous", count: candidates.length };
  return { kind: "found", session: candidates[0] };
}

async function reply(text: string) {
  await sendTelegramMessageDetailed(text);
}

/**
 * Trata uma mensagem do DONO no Telegram (o chamador já validou o segredo do
 * webhook e que o chat é o dele). Nunca lança — o Telegram reenvia o update se
 * a rota falhar, e uma resposta duplicada na conversa é pior que uma perdida.
 */
export async function handleOwnerMessage(inbound: TelegramInbound): Promise<void> {
  try {
    const adminId = await resolveAdminUserId();
    if (!adminId) {
      await reply("Nenhum administrador da plataforma cadastrado para responder em seu nome.");
      return;
    }

    const lookup = await runWithUserContext(adminId, (db) =>
      findTarget(db, inbound.replyToMessageId),
    );

    if (lookup.kind === "none") {
      await reply("Não há conversa de suporte aberta para responder.");
      return;
    }
    if (lookup.kind === "ambiguous") {
      await reply(
        `Há ${lookup.count} pedidos de suporte em aberto. Use "Responder" na mensagem do pedido que quer atender, para eu saber de quem é.`,
      );
      return;
    }

    const { session } = lookup;
    const command = parseOwnerCommand(inbound.text);
    const plan = planOwnerReply({ status: session.status, command: command.kind });

    if (plan === "hint_panel") {
      const url = adminPanelUrl();
      await reply(
        `A tela dessa pessoa já está compartilhada: a conversa continua no painel de suporte.${url ? `\n${url}` : ""}`,
      );
      return;
    }
    if (plan === "hint_closed") {
      await reply("Essa conversa já foi encerrada.");
      return;
    }
    if (!session.subjectUserId) return;

    // Trava contra o Telegram reenviando este mesmo update.
    const firstTime = await rememberTelegramMessage(session.id, inbound.messageId);
    if (!firstTime) return;

    const subjectId = session.subjectUserId;
    const names = await runWithUserContext(adminId, (db) =>
      getUserDisplayInfoByIds(db, [subjectId]),
    );
    const userName = names.get(subjectId)?.name ?? "Usuário";

    if (plan === "end" || command.kind === "end") {
      await runWithUserContext(adminId, async (db) => {
        await db
          .update(liveSessions)
          .set({
            status: "ended",
            endedAt: new Date(),
            controlGranted: false,
            screenRequested: false,
          })
          .where(eq(liveSessions.id, session.id));
        await recordAudit(db, {
          actorUserId: adminId,
          organizationId: session.organizationId,
          action: "live_support.encerrar_telegram",
        });
      });
      await broadcast(liveSessionChannelName(session.id), "status", { status: "ended" });
      await reply(`Conversa com ${userName} encerrada.`);
      return;
    }

    const body = normalizeChatMessage(command.body);
    if (!body) return;

    const opened = plan === "open_and_message";
    const { row: message } = await runWithUserContext(adminId, (db) =>
      postAdminChatMessage(db, {
        session: {
          id: session.id,
          organizationId: session.organizationId,
          status: session.status,
          subjectUserId: subjectId,
        },
        adminId,
        body,
        auditAction: "live_support.conversa_telegram",
      }),
    );

    // Quem está com o app aberto passa a ver a caixa de conversa agora; quem
    // não está, vê ao entrar (a sessão `chat` volta no carregamento do app).
    await announceAdminChatMessage({
      sessionId: session.id,
      subjectUserId: subjectId,
      row: message,
      opened,
    });

    if (opened) {
      await reply(
        formatConversationOpened({ userName, organizationName: session.organizationName }),
      );
    }
  } catch (err) {
    logger.error("telegram.resposta_falhou", {
      reason: err instanceof Error ? err.message : "desconhecido",
    });
  }
}

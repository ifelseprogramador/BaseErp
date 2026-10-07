import "server-only";
import { eq } from "drizzle-orm";
import type { Database } from "@/core/db";
import { liveSessionMessages, liveSessions } from "@/db/schema";
import { recordAudit } from "@/core/admin/audit";
import { sendBroadcast as broadcast } from "@/core/supabase/realtime-sender";
import { liveSessionChannelName, userSupportChannelName } from "./realtime";

/**
 * O dono do suporte escreve para a pessoa — pelo Telegram (`telegram-bridge.ts`)
 * ou pelo painel (`actions.ts#sendAdminMessage`). Um só caminho para os dois:
 * se a sessão ainda não é uma conversa (`missed`/`pending`), ela passa a
 * `chat` (conversa só por texto) e a mensagem entra no histórico; o aviso em
 * tempo real vai separado (`announceAdminChatMessage`), depois do commit.
 */
export interface ChatTarget {
  id: string;
  organizationId: string;
  status: string;
  subjectUserId: string;
}

export async function postAdminChatMessage(
  db: Database,
  input: { session: ChatTarget; adminId: string; body: string; auditAction: string },
) {
  const { session, adminId } = input;
  const opened = session.status !== "chat";
  if (opened) {
    await db
      .update(liveSessions)
      .set({ status: "chat", adminUserId: adminId, expiresAt: null })
      .where(eq(liveSessions.id, session.id));
    await recordAudit(db, {
      actorUserId: adminId,
      organizationId: session.organizationId,
      action: input.auditAction,
    });
  }
  const [row] = await db
    .insert(liveSessionMessages)
    .values({
      sessionId: session.id,
      organizationId: session.organizationId,
      senderUserId: adminId,
      senderRole: "admin",
      body: input.body,
    })
    .returning();
  return { row, opened };
}

/** Avisa a pessoa em tempo real: abre a caixa (se a conversa acabou de nascer) e entrega a mensagem. */
export async function announceAdminChatMessage(input: {
  sessionId: string;
  subjectUserId: string;
  row: { id: string; body: string; createdAt: Date };
  opened: boolean;
}) {
  if (input.opened) {
    await broadcast(userSupportChannelName(input.subjectUserId), "chat-open", {
      sessionId: input.sessionId,
    });
  }
  await broadcast(liveSessionChannelName(input.sessionId), "message", {
    id: input.row.id,
    role: "admin",
    body: input.row.body,
    createdAt: input.row.createdAt.toISOString(),
  });
}

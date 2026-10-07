import { timingSafeEqual } from "node:crypto";

/**
 * Regras PURAS (sem rede, sem banco) do que chega do Telegram pelo webhook —
 * testáveis isoladamente. A ordem de confiança é: (1) o segredo do cabeçalho
 * confere, (2) a mensagem veio do chat do dono, (3) só então vira ação.
 */

export interface TelegramInbound {
  messageId: number;
  chatId: number;
  fromId: number | null;
  text: string;
  /** `message_id` da mensagem a que o dono respondeu ("Responder"), se houver. */
  replyToMessageId: number | null;
}

/** Extrai a mensagem de TEXTO de um update do Telegram; qualquer outra coisa
 * (foto, edição, grupo sem texto, lixo) vira `null`. */
export function parseTelegramUpdate(update: unknown): TelegramInbound | null {
  if (!update || typeof update !== "object") return null;
  const message = (update as { message?: unknown }).message;
  if (!message || typeof message !== "object") return null;
  const m = message as {
    message_id?: unknown;
    text?: unknown;
    chat?: { id?: unknown };
    from?: { id?: unknown };
    reply_to_message?: { message_id?: unknown };
  };
  if (typeof m.text !== "string" || !m.text.trim()) return null;
  if (typeof m.message_id !== "number" || typeof m.chat?.id !== "number") return null;
  return {
    messageId: m.message_id,
    chatId: m.chat.id,
    fromId: typeof m.from?.id === "number" ? m.from.id : null,
    text: m.text.trim(),
    replyToMessageId:
      typeof m.reply_to_message?.message_id === "number" ? m.reply_to_message.message_id : null,
  };
}

/** O chat é o do dono (`TELEGRAM_CHAT_ID`)? Compara como texto: o id pode ser negativo (grupo). */
export function isOwnerChat(
  inbound: Pick<TelegramInbound, "chatId">,
  configured: string | undefined,
) {
  return Boolean(configured) && String(inbound.chatId) === String(configured).trim();
}

/** Compara o segredo do webhook em tempo constante. Sem segredo configurado, recusa tudo. */
export function secretMatches(received: string | null, expected: string | undefined): boolean {
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type OwnerCommand = { kind: "end" } | { kind: "message"; body: string };

/** `/fim` (ou `/encerrar`) encerra a conversa; qualquer outro texto é a resposta. */
export function parseOwnerCommand(text: string): OwnerCommand {
  const trimmed = text.trim();
  if (/^\/(fim|encerrar)(@\w+)?$/i.test(trimmed)) return { kind: "end" };
  return { kind: "message", body: trimmed };
}

/** Texto da mensagem do usuário encaminhada ao Telegram do dono. */
export function formatForwardedMessage(input: {
  userName: string;
  organizationName: string;
  body: string;
}): string {
  return `💬 ${input.userName} (${input.organizationName}):\n${input.body}\n\n↩️ Use "Responder" nesta mensagem para falar com ele.`;
}

export function formatConversationOpened(input: { userName: string; organizationName: string }) {
  return `💬 Conversa aberta com ${input.userName} (${input.organizationName}). O que você responder aqui aparece na caixa de conversa dele, e o que ele escrever chega aqui. Mande /fim para encerrar.`;
}

/** Aviso ao dono quando a tela começa a ser compartilhada: a conversa muda de lugar. */
export function formatScreenStarted(input: {
  userName: string;
  organizationName: string;
  adminUrl?: string;
}) {
  const lines = [
    `📺 ${input.userName} (${input.organizationName}) liberou a tela. A conversa continua no painel de suporte — não é mais por aqui.`,
  ];
  if (input.adminUrl) lines.push(input.adminUrl);
  return lines.join("\n");
}

export type OwnerPlan =
  /** A tela já está compartilhada: a conversa mudou para o painel. */
  | "hint_panel"
  /** A conversa já acabou (ou não é uma que dê para responder). */
  | "hint_closed"
  /** Encerrar a conversa. */
  | "end"
  /** Primeira resposta: abre a conversa por texto e grava a mensagem. */
  | "open_and_message"
  /** Conversa por texto já aberta: só grava a mensagem. */
  | "message";

/**
 * O que fazer com uma mensagem do dono, dado o estado da sessão a que ela se
 * refere. É a regra de "a conversa muda do Telegram para o painel": com a tela
 * compartilhada (`active`) o Telegram deixa de ser o canal. Pura, para teste.
 */
export function planOwnerReply(input: {
  status: string;
  command: OwnerCommand["kind"];
}): OwnerPlan {
  if (input.status === "active") return "hint_panel";
  if (input.status !== "missed" && input.status !== "pending" && input.status !== "chat") {
    return "hint_closed";
  }
  if (input.command === "end") return "end";
  return input.status === "chat" ? "message" : "open_and_message";
}

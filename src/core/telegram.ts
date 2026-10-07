import "server-only";
import { logger } from "@/core/logger";

/**
 * Telegram do dono da plataforma. Configuração por variáveis de ambiente (o
 * token nunca fica no banco nem aparece em tela):
 *   TELEGRAM_BOT_TOKEN      — token do bot (@BotFather)
 *   TELEGRAM_CHAT_ID        — id do chat do dono (quem recebe os avisos E é o
 *                             único que pode responder)
 *   TELEGRAM_WEBHOOK_SECRET — segredo que o Telegram devolve no cabeçalho de
 *                             cada resposta (valida que veio mesmo dele);
 *                             obrigatório para responder pelo Telegram
 *   TELEGRAM_ADMIN_USER_ID  — (opcional) usuário admin em nome de quem a
 *                             resposta é gravada; sem isso, o admin mais antigo
 * Sem token e chat id, não envia e só registra no log — o pedido continua
 * aparecendo no painel `/admin`. Melhor esforço: nunca lança (um Telegram fora
 * do ar não pode quebrar o "Chamar suporte" do usuário).
 */
export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export function isTelegramWebhookConfigured(): boolean {
  return isTelegramConfigured() && Boolean(process.env.TELEGRAM_WEBHOOK_SECRET);
}

export type TelegramSendResult =
  | { ok: true; messageId?: number }
  | { ok: false; reason: "not_configured" | "rejected" | "network"; detail?: string };

interface TelegramApiBody {
  ok?: boolean;
  description?: string;
  result?: unknown;
}

async function callTelegram(
  method: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true; result: unknown } | Extract<TelegramSendResult, { ok: false }>> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn("telegram.nao_configurado");
    return { ok: false, reason: "not_configured" };
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });
    const body = (await response.json().catch(() => null)) as TelegramApiBody | null;
    if (!response.ok) {
      // Nunca loga a URL (tem o token) — só o status e a descrição do Telegram.
      logger.error("telegram.envio_falhou", {
        method,
        status: response.status,
        detail: body?.description,
      });
      return { ok: false, reason: "rejected", detail: body?.description };
    }
    return { ok: true, result: body?.result };
  } catch (err) {
    logger.error("telegram.envio_falhou", {
      method,
      reason: err instanceof Error ? err.name : "desconhecido",
    });
    return { ok: false, reason: "network" };
  }
}

/**
 * Envia ao chat do dono e devolve o `messageId` — é por ele que uma RESPOSTA
 * ("Responder" naquela mensagem) volta à sessão certa. Quando falha, explica o
 * motivo (`detail` é a descrição do Telegram, que nunca contém o token).
 */
export async function sendTelegramMessageDetailed(text: string): Promise<TelegramSendResult> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!process.env.TELEGRAM_BOT_TOKEN || !chatId) {
    logger.warn("telegram.nao_configurado");
    return { ok: false, reason: "not_configured" };
  }
  const result = await callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
  if (!result.ok) return result;
  const messageId = (result.result as { message_id?: number } | undefined)?.message_id;
  return { ok: true, messageId };
}

export async function sendTelegramMessage(text: string): Promise<boolean> {
  return (await sendTelegramMessageDetailed(text)).ok;
}

/** Aponta o bot para a nossa rota, com o segredo que o Telegram vai devolver. */
export async function setTelegramWebhook(url: string, secret: string): Promise<TelegramSendResult> {
  const result = await callTelegram("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
  return result.ok ? { ok: true } : result;
}

export interface TelegramWebhookInfo {
  url: string;
  pendingUpdateCount: number;
  lastErrorMessage?: string;
}

export async function getTelegramWebhookInfo(): Promise<
  { ok: true; info: TelegramWebhookInfo } | Extract<TelegramSendResult, { ok: false }>
> {
  const result = await callTelegram("getWebhookInfo", {});
  if (!result.ok) return result;
  const raw = (result.result ?? {}) as {
    url?: string;
    pending_update_count?: number;
    last_error_message?: string;
  };
  return {
    ok: true,
    info: {
      url: raw.url ?? "",
      pendingUpdateCount: raw.pending_update_count ?? 0,
      lastErrorMessage: raw.last_error_message,
    },
  };
}

import "server-only";
import { logger } from "@/core/logger";

/**
 * Aviso ao dono da plataforma pelo Telegram. Configuração por variáveis de
 * ambiente (o token nunca fica no banco nem aparece em tela):
 *   TELEGRAM_BOT_TOKEN  — token do bot (@BotFather)
 *   TELEGRAM_CHAT_ID    — id do chat/usuário que recebe (fale com o bot e
 *                         consulte `getUpdates`, ou use @userinfobot)
 * Sem as duas, não envia e só registra no log — o pedido continua aparecendo
 * no painel `/admin`. Melhor esforço: nunca lança (um Telegram fora do ar não
 * pode quebrar o "Chamar suporte" do usuário).
 */
export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export type TelegramSendResult =
  { ok: true } | { ok: false; reason: "not_configured" | "rejected" | "network"; detail?: string };

/**
 * Envia e explica o motivo quando falha — usado pelo botão "Enviar mensagem de
 * teste" do `/admin`. `detail` é a descrição devolvida pelo Telegram (ex.:
 * "Unauthorized", "Bad Request: chat not found"), que nunca contém o token.
 */
export async function sendTelegramMessageDetailed(text: string): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    logger.warn("telegram.nao_configurado");
    return { ok: false, reason: "not_configured" };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { description?: string } | null;
      // Nunca loga a URL (tem o token) — só o status e a descrição do Telegram.
      logger.error("telegram.envio_falhou", { status: response.status, detail: body?.description });
      return { ok: false, reason: "rejected", detail: body?.description };
    }
    return { ok: true };
  } catch (err) {
    logger.error("telegram.envio_falhou", {
      reason: err instanceof Error ? err.name : "desconhecido",
    });
    return { ok: false, reason: "network" };
  }
}

export async function sendTelegramMessage(text: string): Promise<boolean> {
  return (await sendTelegramMessageDetailed(text)).ok;
}

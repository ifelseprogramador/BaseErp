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

export async function sendTelegramMessage(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    logger.warn("telegram.nao_configurado");
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      // Nunca loga o corpo da URL (tem o token) — só o status.
      logger.error("telegram.envio_falhou", { status: response.status });
      return false;
    }
    return true;
  } catch (err) {
    logger.error("telegram.envio_falhou", {
      reason: err instanceof Error ? err.name : "desconhecido",
    });
    return false;
  }
}

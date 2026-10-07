import { NextRequest } from "next/server";
import { logger } from "@/core/logger";
import { handleOwnerMessage } from "@/core/live-support/telegram-bridge";
import {
  isOwnerChat,
  parseTelegramUpdate,
  secretMatches,
} from "@/core/live-support/telegram-update";

/**
 * Respostas do dono pelo Telegram (registradas com `setWebhook` — botão em
 * `/admin`). Três barreiras, nesta ordem: (1) o cabeçalho
 * `X-Telegram-Bot-Api-Secret-Token` confere com `TELEGRAM_WEBHOOK_SECRET`
 * (prova que o pedido veio do Telegram); (2) a mensagem veio do chat do dono
 * (`TELEGRAM_CHAT_ID`) — qualquer outra pessoa que falar com o bot é ignorada
 * em silêncio, sem resposta; (3) só então vira ação. Sempre responde 200 depois
 * da primeira barreira: o Telegram reenvia o update se receber erro, e uma
 * resposta duplicada na conversa é pior que uma perdida.
 */
export async function POST(request: NextRequest) {
  const received = request.headers.get("x-telegram-bot-api-secret-token");
  if (!secretMatches(received, process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response("Não autorizado.", { status: 401 });
  }

  const update = await request.json().catch(() => null);
  const inbound = parseTelegramUpdate(update);
  if (!inbound) return Response.json({ ok: true });

  if (!isOwnerChat(inbound, process.env.TELEGRAM_CHAT_ID)) {
    logger.warn("telegram.webhook.chat_desconhecido");
    return Response.json({ ok: true });
  }

  await handleOwnerMessage(inbound);
  return Response.json({ ok: true });
}

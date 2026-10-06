import type { ChatMessageDto } from "./actions";

/**
 * Ponte entre o canal Realtime da sessão (que o widget do usuário e o viewer
 * do admin já mantêm abertos) e o painel de chat: quem recebe o broadcast
 * `message` avisa por este evento do `window`, e `SupportChat` escuta. Assim o
 * chat não abre um SEGUNDO canal com o mesmo nome (o supabase-js reaproveita o
 * canal já inscrito e recusa `.on()` depois do `subscribe()`).
 */
export const SUPPORT_CHAT_EVENT = "support-chat-message";

export function dispatchChatMessage(sessionId: string, message: ChatMessageDto) {
  window.dispatchEvent(new CustomEvent(SUPPORT_CHAT_EVENT, { detail: { sessionId, message } }));
}

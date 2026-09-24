import { createSupabaseBrowserClient } from "@/core/supabase/client";

/**
 * Transporte em tempo real da sessão de suporte ao vivo: Supabase Realtime
 * Broadcast, não Postgres Changes. Motivo: Broadcast não depende de RLS
 * — cada canal é nomeado com um id de sessão (UUID, imprevisível) — a
 * "senha" do canal é o próprio id, do mesmo jeito que um link de
 * videochamada. A autoridade de verdade continua sendo sempre a linha em
 * `live_sessions` no banco (lida via Server Action), nunca o que chega
 * pelo Broadcast — o Broadcast só avisa "algo mudou, releia".
 */

export function liveSessionChannelName(sessionId: string) {
  return `live-session:${sessionId}`;
}

/** Canal por organização — onde o widget do usuário escuta pedidos do admin. */
export function orgSupportChannelName(organizationId: string) {
  return `support-org:${organizationId}`;
}

/** Canal global — onde o dashboard do admin escuta pedidos abertos por usuários. */
export function adminSupportInboxChannelName() {
  return "support-admin-inbox";
}

export function getRealtimeChannel(name: string) {
  const supabase = createSupabaseBrowserClient();
  return supabase.channel(name);
}

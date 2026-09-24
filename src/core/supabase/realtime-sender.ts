import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/core/env";

/**
 * Envia um evento de Realtime Broadcast a partir do servidor (dentro de
 * uma Server Action), sem manter conexão aberta — usa o envio via REST do
 * Realtime (`channel.send`) em vez do client `createBrowserClient`. Ver
 * `core/live-support/realtime.ts` para os nomes de canal e o modelo de
 * confiança (autoridade sempre no banco, o Broadcast só avisa "releia").
 */
export async function sendBroadcast(channelName: string, event: string, payload: unknown) {
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
  const channel = supabase.channel(channelName);
  try {
    await channel.send({ type: "broadcast", event, payload });
  } finally {
    await supabase.removeChannel(channel);
  }
}

import { createBrowserClient } from "@supabase/ssr";

// IMPORTANTE: acesso ESTÁTICO (`process.env.NEXT_PUBLIC_X`), nunca via
// `requireEnv(name)`/`process.env[name]`. O Next.js só consegue substituir
// uma variável `NEXT_PUBLIC_*` pelo valor real no bundle do navegador
// quando enxerga a propriedade escrita literalmente no código — um acesso
// dinâmico por string vira `undefined` em produção E em dev, silenciosamente.
// Ver docs/decisoes.md.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Cliente Supabase para uso em Client Components (ex.: login, Realtime). */
export function createSupabaseBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY não configuradas. Veja .env.example.",
    );
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

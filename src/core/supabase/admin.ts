import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/core/env";

/**
 * Cliente Supabase com a service role key — ignora RLS do Supabase Auth e
 * confirmação de e-mail. Só para o backend da área `/admin` (criar o
 * usuário dono de uma organização nova) e para `src/db/seed.ts`. NUNCA
 * importar isto de dentro de `modules/` nem expor ao cliente.
 */
export function createSupabaseAdminClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
}

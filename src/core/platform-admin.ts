import "server-only";
import { sql } from "drizzle-orm";
import { runWithUserContext } from "@/core/db";

/**
 * Checagem crua de "esse usuário é dono da plataforma?" — sem lançar, sem
 * log. Compartilhada por `core/admin-auth.ts#requireAdmin()` (bloqueia
 * quem não é admin) e `core/auth.ts#getActiveOrg()` (permite o modo
 * suporte/impersonation). Fica num arquivo à parte só para evitar import
 * circular entre os dois.
 *
 * Chama a função SQL `is_current_user_platform_admin()` (SECURITY
 * DEFINER — ver migrations-custom/0002_platform_admin_rls.sql) dentro de
 * uma transação com `app.current_user_id` já definido como `userId`, em
 * vez de fazer `select ... from platform_admins` direto: com RLS ativa
 * (docs/decisoes.md), uma leitura direta da tabela só enxergaria a linha
 * se o próprio usuário já fosse admin — exatamente a pergunta que ainda
 * não sabemos responder.
 */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  return runWithUserContext(userId, async (tx) => {
    const [row] = await tx.execute<{ is_admin: boolean }>(
      sql`select public.is_current_user_platform_admin() as is_admin`,
    );
    return Boolean(row?.is_admin);
  });
}

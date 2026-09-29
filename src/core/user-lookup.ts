import "server-only";
import { sql } from "drizzle-orm";
import type { Database } from "@/core/db";

export interface UserDisplayInfo {
  email: string | null;
  /** Nome de exibição (`core/profile/`) quando definido, senão o
   * e-mail, senão o próprio UUID — nunca vazio, sempre o melhor rótulo
   * disponível pra mostrar em vez do UID cru. */
  name: string;
}

/**
 * `auth.users` não é modelado pelo Drizzle (schema gerenciado pelo
 * Supabase Auth) — e, com RLS ativa, um `select` direto nessa tabela
 * pelo papel da aplicação sempre devolve 0 linhas: `auth.users` tem RLS
 * própria do Supabase (fora do controle deste projeto), que não conhece
 * `app.current_user_id`/`is_current_user_platform_admin()`. Por isso o
 * lookup passa pela função SECURITY DEFINER
 * `public.get_user_display_info` (`migrations-custom/0010_...sql`), que
 * atravessa essa RLS de propósito e só devolve linha se quem chamou for
 * platform admin — checado DENTRO da função, não aqui.
 *
 * Único lugar que monta esse lookup: toda tela que precisa mostrar quem
 * é uma pessoa a partir de um `userId` solto (lista de membros,
 * histórico de auditoria, "quem leu" de notificação) usa isto em vez de
 * cair no UUID cru quando falta e-mail.
 */
export async function getUserDisplayInfoByIds(
  db: Database,
  userIds: Iterable<string>,
): Promise<Map<string, UserDisplayInfo>> {
  const ids = Array.from(new Set(userIds));
  if (ids.length === 0) return new Map();

  const rows = await db.execute<{
    id: string;
    email: string | null;
    display_name: string | null;
  }>(
    sql`select * from public.get_user_display_info(array[${sql.join(
      ids.map((id) => sql`${id}::uuid`),
      sql`, `,
    )}])`,
  );

  return new Map(
    Array.from(rows).map((u) => [
      u.id,
      { email: u.email, name: u.display_name?.trim() || u.email || u.id },
    ]),
  );
}

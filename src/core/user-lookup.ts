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
 * Supabase Auth) — lido com SQL bruto, na mesma conexão/transação.
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
    sql`select id, email, raw_user_meta_data->>'display_name' as display_name from auth.users where id in (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )})`,
  );

  return new Map(
    Array.from(rows).map((u) => [
      u.id,
      { email: u.email, name: u.display_name?.trim() || u.email || u.id },
    ]),
  );
}

import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { organizations } from "./tenancy";

/**
 * Quem criou / quem alterou por último um registro de negócio. Espalhe
 * `...auditColumns` nas colunas de toda tabela de módulo em que "quem fez?"
 * importa (ver docs/arquitetura.md, "Auditoria de negócio") e, na migration
 * custom do módulo, ligue o gatilho: `select public.apply_audit_columns('tabela');`.
 *
 * Quem preenche é o BANCO (gatilho `set_audit_columns`, lendo
 * `app.current_user_id` — o mesmo que a RLS já usa), não cada action: um
 * insert/update esquecido numa action nova ainda sai com autoria. Sem
 * sessão de usuário (cron, seed) as colunas ficam nulas. Sem FK para
 * `auth.users` de propósito — apagar uma conta não pode travar nem apagar
 * o histórico de quem a usou.
 */
export const auditColumns = {
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
};

/**
 * Linha do tempo de mudanças de status de qualquer entidade (OS, pedido...):
 * quem mudou, de qual para qual, quando. Só inserida por
 * `core/status-history.ts#recordStatusChange`, na MESMA transação da
 * mudança de status; nunca editada (a RLS não tem policy de update/delete
 * para membros). `entityTable` é o nome da tabela da entidade (texto, sem
 * FK — a entidade pode ser de qualquer módulo).
 */
export const statusHistory = pgTable(
  "status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    entityTable: text("entity_table").notNull(),
    entityId: uuid("entity_id").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    changedBy: uuid("changed_by"),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("status_history_entity_idx").on(table.entityTable, table.entityId)],
);

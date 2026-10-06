import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { Database } from "@/core/db";
import { statusHistory } from "@/db/schema";

/**
 * Registra uma mudança de status (OS, pedido...). Chame SEMPRE dentro da
 * mesma transação que muda o status (`withDb`), logo depois do `UPDATE`
 * bem-sucedido: ou as duas coisas acontecem ou nenhuma — a linha do tempo
 * nunca diverge do status real. `userId` é a pessoa da sessão (a policy
 * `status_history_insert_own_org` exige `changed_by = app.current_user_id`).
 */
export async function recordStatusChange(
  tx: Database,
  input: {
    organizationId: string;
    userId: string;
    entityTable: string;
    entityId: string;
    fromStatus: string | null;
    toStatus: string;
  },
) {
  await tx.insert(statusHistory).values({
    organizationId: input.organizationId,
    entityTable: input.entityTable,
    entityId: input.entityId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    changedBy: input.userId,
  });
}

/** Mudanças de status de uma entidade, da mais antiga para a mais nova. */
export async function listStatusHistory(
  tx: Database,
  organizationId: string,
  entityTable: string,
  entityId: string,
) {
  return tx
    .select()
    .from(statusHistory)
    .where(
      and(
        eq(statusHistory.organizationId, organizationId),
        eq(statusHistory.entityTable, entityTable),
        eq(statusHistory.entityId, entityId),
      ),
    )
    .orderBy(asc(statusHistory.changedAt));
}

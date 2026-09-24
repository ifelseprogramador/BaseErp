import "server-only";
import { desc, eq } from "drizzle-orm";
import type { Database } from "@/core/db";
import { auditLog } from "@/db/schema";
import { logger } from "@/core/logger";

/**
 * Registra uma linha na trilha de auditoria. Nunca lança — uma falha ao
 * gravar auditoria não pode derrubar a ação de admin que a chamou (só é
 * logado). Chamar depois que a ação principal já teve sucesso.
 *
 * Recebe `db` explícito (o `tx` de `requireAdmin().withDb(...)`) — ver
 * divergência de contrato documentada em `core/admin-auth.ts`.
 */
export async function recordAudit(
  db: Database,
  input: {
    actorUserId: string;
    organizationId?: string | null;
    action: string;
    metadata?: Record<string, unknown>;
  },
) {
  try {
    await db.insert(auditLog).values({
      actorUserId: input.actorUserId,
      organizationId: input.organizationId ?? null,
      action: input.action,
      metadata: input.metadata ?? null,
    });
  } catch (err) {
    logger.error("audit.gravar_falhou", { err, action: input.action });
  }
}

export async function getAuditLogForOrg(db: Database, organizationId: string, limit = 50) {
  return db
    .select()
    .from(auditLog)
    .where(eq(auditLog.organizationId, organizationId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}

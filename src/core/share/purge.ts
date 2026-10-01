import "server-only";
import { lt, or } from "drizzle-orm";
import type { Database } from "@/core/db";
import { sharedDocuments } from "@/db/schema";

/** Dias de carência depois de expirar/revogar antes de apagar de vez. */
export const SHARE_PURGE_GRACE_DAYS = 7;

/** Data limite: expirados/revogados antes dela podem ser apagados (pura, testável). */
export function purgeCutoff(now: Date, graceDays = SHARE_PURGE_GRACE_DAYS): Date {
  return new Date(now.getTime() - graceDays * 24 * 60 * 60 * 1000);
}

/**
 * Apaga os snapshots de documentos compartilhados já expirados ou revogados
 * (LGPD: o snapshot guarda dado pessoal do cliente e não deve ficar além do
 * necessário). Chamar dentro de `runWithSystemContext` (cron), pois varre
 * todas as organizações. Devolve quantos foram apagados.
 */
export async function purgeSharedDocuments(db: Database, now = new Date()): Promise<number> {
  const cutoff = purgeCutoff(now);
  const rows = await db
    .delete(sharedDocuments)
    .where(or(lt(sharedDocuments.expiresAt, cutoff), lt(sharedDocuments.revokedAt, cutoff)))
    .returning({ id: sharedDocuments.id });
  return rows.length;
}

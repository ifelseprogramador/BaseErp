import { NextRequest } from "next/server";
import { requireEnv } from "@/core/env";
import { logger } from "@/core/logger";
import { runWithSystemContext } from "@/core/db";
import { purgeSharedDocuments } from "@/core/share/purge";

/**
 * Limpeza diária dos documentos compartilhados expirados/revogados
 * (`vercel.json`, `30 6 * * *`). Mesma proteção do backup: exige
 * `Authorization: Bearer <CRON_SECRET>` (o Vercel Cron manda sozinho) e
 * roda em `runWithSystemContext` para enxergar todas as organizações.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${requireEnv("CRON_SECRET")}`) {
    return new Response("Não autorizado.", { status: 401 });
  }

  const deleted = await runWithSystemContext((db) => purgeSharedDocuments(db));
  logger.info("cron.purge_shared.concluido", { deleted });
  return Response.json({ deleted });
}

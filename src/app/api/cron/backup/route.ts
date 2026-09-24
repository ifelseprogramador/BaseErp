import { NextRequest } from "next/server";
import { requireEnv } from "@/core/env";
import { logger } from "@/core/logger";
import { runWithSystemContext } from "@/core/db";
import { buildOrgBackup, listOrgsWithAutoBackupEnabled, saveAutomaticBackup } from "@/core/backup";

/**
 * Backup automático diário — disparado pelo Vercel Cron (`vercel.json`,
 * `0 6 * * *` = 06h UTC = 03h em Brasília). Protegido por `CRON_SECRET`:
 * o Vercel Cron manda automaticamente `Authorization: Bearer <CRON_SECRET>`
 * quando essa variável existe no projeto — sem ela configurada, esta
 * rota bloqueia qualquer chamada (nunca roda "aberta").
 *
 * Roda dentro de `runWithSystemContext` (equivalente a admin para fins de
 * RLS — ver docs/decisoes.md) porque precisa enxergar TODAS as
 * organizações, não uma sessão de usuário específica.
 *
 * Roda sequencialmente (não `Promise.all`) de propósito: uma organização
 * com muitos dados não deve competir por conexão de banco com as outras
 * ao mesmo tempo, e se uma falhar, loga e segue pras próximas em vez de
 * derrubar o backup de todo mundo.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${requireEnv("CRON_SECRET")}`) {
    return new Response("Não autorizado.", { status: 401 });
  }

  const { total, succeeded, failed } = await runWithSystemContext(async (db) => {
    const orgs = await listOrgsWithAutoBackupEnabled(db);
    let succeeded = 0;
    let failed = 0;

    for (const org of orgs) {
      try {
        const backup = await buildOrgBackup(db, org.id, org.name);
        await saveAutomaticBackup(db, org.id, backup);
        succeeded++;
      } catch (err) {
        failed++;
        logger.error("cron.backup.falhou", { organizationId: org.id, err });
      }
    }

    return { total: orgs.length, succeeded, failed };
  });

  logger.info("cron.backup.concluido", { total, succeeded, failed });
  return Response.json({ total, succeeded, failed });
}

import { getActiveOrg, withOrg } from "@/core/auth";
import { getAutomaticBackup } from "@/core/backup";

/** Baixa um backup automático específico (gerado pelo cron diário) —
 * mesmo formato/rota-irmã de `GET /backup/exportar` (manual), já
 * checando que o backup pedido é da organização de quem está logado. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ withDb }, org] = await Promise.all([withOrg(), getActiveOrg()]);

  const backup = await withDb((tx) => getAutomaticBackup(tx, org.organizationId, id));
  if (!backup) {
    return new Response("Backup não encontrado.", { status: 404 });
  }

  const filename = `baseerp-backup-${org.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${backup.exportedAt.slice(0, 10)}.json`;

  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

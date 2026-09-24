import { NotPlatformAdminError, requireAdmin } from "@/core/admin-auth";
import { buildSystemBackup } from "@/core/backup";

/**
 * Backup de TODAS as organizações da plataforma — só o dono (`/admin`)
 * tem acesso. Cada organização vem isolada dentro de `organizations[]`,
 * no MESMO formato que `GET /backup/exportar` gera pra uma organização
 * (ver `core/backup.ts`) — dá pra restaurar uma organização específica
 * daqui com `core/backup.ts#restoreOrgBackup`, mas o arquivo inteiro não
 * tem restauração automática de sistema (ver comentário em
 * `buildSystemBackup`).
 *
 * Diferente de uma Server Action (onde um `throw` vira um erro tratado
 * pela árvore de componentes), um Route Handler sem try/catch devolveria
 * um 500 genérico pra qualquer pessoa logada que tentasse acessar esta
 * URL direto — funcionalmente já bloqueado (nenhum dado vaza), mas o
 * catch abaixo devolve um 403 de verdade em vez de um erro de servidor
 * confuso.
 */
export async function GET() {
  let context: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    context = await requireAdmin();
  } catch (err) {
    if (err instanceof NotPlatformAdminError) {
      return new Response("Acesso restrito ao dono da plataforma.", { status: 403 });
    }
    throw err;
  }
  context.log.info("admin.backup.exportar");

  const backup = await context.withDb((db) => buildSystemBackup(db));
  const filename = `baseerp-backup-sistema-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

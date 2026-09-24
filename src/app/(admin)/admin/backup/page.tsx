import { BackButton } from "@/components/back-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SystemBackupDownloadButton } from "@/core/admin/components/system-backup-download-button";

/**
 * Backup de TODA a plataforma (todas as organizações), só para o dono —
 * diferente de `(app)/backup`, que é o backup de uma organização só,
 * disponível pra ela mesma. Ver `src/app/(admin)/admin/backup/exportar/route.ts`.
 */
export default function AdminSystemBackupPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div className="flex items-center gap-2">
        <BackButton href="/admin" />
        <h1 className="text-2xl font-semibold tracking-tight">Backup do sistema</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Baixar backup de todas as organizações</CardTitle>
          <CardDescription>
            Um único arquivo JSON com os dados de cada organização isolados entre si — o mesmo
            formato do backup individual de cada organização, então dá para restaurar uma
            organização específica a partir dele. Não existe restauração automática do sistema
            inteiro a partir deste arquivo (ver comentário em `core/backup.ts#buildSystemBackup`).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SystemBackupDownloadButton />
        </CardContent>
      </Card>
    </div>
  );
}

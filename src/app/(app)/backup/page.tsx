import { ActionLink } from "@/components/action-link";
import { Download, History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackupDownloadButton } from "@/components/backup-download-button";
import { BackupRestoreForm } from "@/components/backup-restore-form";
import { AutoBackupToggle } from "@/components/auto-backup-toggle";
import { getAutoBackupEnabled, listAutomaticBackups } from "@/core/backup";
import { withOrg } from "@/core/auth";
import { formatDate } from "@/core/format";

export default async function BackupPage() {
  const { organizationId, withDb } = await withOrg();
  const [autoBackupEnabled, automaticBackups] = await withDb((tx) =>
    Promise.all([
      getAutoBackupEnabled(tx, organizationId),
      listAutomaticBackups(tx, organizationId),
    ]),
  );

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Backup</h1>
        <p className="text-muted-foreground text-sm">
          Cópia dos dados da sua organização. Sem módulos de negócio instalados ainda, o backup só
          traz a estrutura — o conteúdo cresce conforme módulos são adicionados.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fazer backup agora</CardTitle>
          <CardDescription>
            No celular, você pode enviar direto pro Google Drive, WhatsApp, e-mail ou qualquer app —
            no computador, baixa como arquivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <BackupDownloadButton />
          <AutoBackupToggle initialEnabled={autoBackupEnabled} />
        </CardContent>
      </Card>

      {automaticBackups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="text-primary h-4 w-4" />
              Backups automáticos
            </CardTitle>
            <CardDescription>Últimos 7 dias — clique pra baixar um deles.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {automaticBackups.map((backup) => (
                <li key={backup.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{formatDate(backup.createdAt)}</span>
                  <ActionLink
                    href={`/backup/automatico/${backup.id}`}
                    icon={Download}
                    className="text-primary"
                  >
                    Baixar
                  </ActionLink>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Restaurar backup</CardTitle>
          <CardDescription>
            Reimporta um arquivo de backup (manual ou automático). Seguro rodar mais de uma vez — o
            que já existe não duplica, só entra o que estava faltando.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BackupRestoreForm />
        </CardContent>
      </Card>
    </div>
  );
}

import { ActionLink } from "@/components/action-link";
import { DatabaseBackup, Download, History, RotateCcw } from "lucide-react";
import { ModePage, ModeSection } from "@/components/facil/mode-layout";
import { getCurrentUiMode } from "@/core/profile/current-ui-mode";
import { BackupDownloadButton } from "@/components/backup-download-button";
import { BackupRestoreForm } from "@/components/backup-restore-form";
import { AutoBackupToggle } from "@/components/auto-backup-toggle";
import { BackupReminderSettings } from "@/components/backup-reminder-settings";
import {
  getAutoBackupEnabled,
  getBackupReminderSettings,
  listAutomaticBackups,
} from "@/core/backup";
import { requireOwner } from "@/core/auth";
import { formatDate } from "@/core/format";

export default async function BackupPage() {
  const { organizationId, withDb } = await requireOwner();
  const [autoBackupEnabled, reminder, automaticBackups] = await withDb((tx) =>
    Promise.all([
      getAutoBackupEnabled(tx, organizationId),
      getBackupReminderSettings(tx, organizationId),
      listAutomaticBackups(tx, organizationId),
    ]),
  );

  const uiMode = await getCurrentUiMode();

  return (
    <ModePage
      mode={uiMode}
      title="Backup"
      subtitle="Cópia dos dados da sua organização. Sem módulos de negócio instalados ainda, o backup só traz a estrutura — o conteúdo cresce conforme módulos são adicionados."
      icon={DatabaseBackup}
      maxWidth="max-w-lg"
    >
      <ModeSection
        mode={uiMode}
        title="Fazer backup agora"
        description="No celular, você pode enviar direto pro Google Drive, WhatsApp, e-mail ou qualquer app — no computador, baixa como arquivo."
        icon={DatabaseBackup}
      >
        <BackupDownloadButton />
        <AutoBackupToggle initialEnabled={autoBackupEnabled} />
        <BackupReminderSettings initialHours={reminder.reminderHours} />
      </ModeSection>

      {automaticBackups.length > 0 && (
        <ModeSection
          mode={uiMode}
          title="Backups automáticos"
          description="Últimos 7 dias — clique pra baixar um deles."
          icon={History}
        >
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
        </ModeSection>
      )}

      <ModeSection
        mode={uiMode}
        title="Restaurar backup"
        description="Reimporta um arquivo de backup (manual ou automático). Seguro rodar mais de uma vez — o que já existe não duplica, só entra o que estava faltando."
        icon={RotateCcw}
      >
        <BackupRestoreForm />
      </ModeSection>
    </ModePage>
  );
}

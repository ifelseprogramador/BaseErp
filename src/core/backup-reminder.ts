/**
 * Regras do lembrete de backup — puras (sem servidor/banco), para o banner no
 * navegador e as ações no servidor usarem as mesmas.
 */

/** Intervalos de lembrete oferecidos, em horas (0 = não lembrar). */
export const BACKUP_REMINDER_OPTIONS = [0, 1, 3, 6, 12, 24, 72, 168] as const;
export const DEFAULT_BACKUP_REMINDER_HOURS = 3;

export interface BackupReminderSettings {
  reminderHours: number;
  /** Última vez que o responsável baixou/compartilhou um backup (manual ou automático). */
  lastDownloadAt: Date | null;
}

export function isValidReminderHours(hours: number): boolean {
  return (BACKUP_REMINDER_OPTIONS as readonly number[]).includes(hours);
}

/** Passou do intervalo escolhido desde o último backup baixado? */
export function isBackupReminderDue(settings: BackupReminderSettings, now: Date): boolean {
  if (settings.reminderHours <= 0) return false;
  if (!settings.lastDownloadAt) return true;
  return now.getTime() - settings.lastDownloadAt.getTime() >= settings.reminderHours * 3_600_000;
}

/** "1 hora", "3 horas", "1 dia", "3 dias"… — para o texto do lembrete. */
export function describeReminderInterval(hours: number): string {
  if (hours <= 0) return "desligado";
  if (hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? "1 dia" : `${days} dias`;
  }
  return hours === 1 ? "1 hora" : `${hours} horas`;
}

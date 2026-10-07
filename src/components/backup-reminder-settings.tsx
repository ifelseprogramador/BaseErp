"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { updateBackupReminder } from "@/core/backup-actions";
import { BACKUP_REMINDER_OPTIONS, describeReminderInterval } from "@/core/backup-reminder";

/** Escolha da frequência do lembrete de backup (ou desligar). */
export function BackupReminderSettings({ initialHours }: { initialHours: number }) {
  const [hours, setHours] = useState(initialHours);
  const [isPending, startTransition] = useTransition();

  function handleChange(next: number) {
    const previous = hours;
    setHours(next);
    startTransition(async () => {
      const result = await updateBackupReminder(next);
      if (result.ok) {
        toast.success(
          next === 0
            ? "Lembrete de backup desligado."
            : `Lembrete a cada ${describeReminderInterval(next)}.`,
        );
      } else {
        setHours(previous);
        toast.error(result.message ?? "Não foi possível salvar.");
      }
    });
  }

  return (
    <div id="lembrete" className="flex flex-col gap-2 rounded-lg border p-3">
      <Label htmlFor="backup-reminder">Lembrete de backup</Label>
      <p className="text-muted-foreground text-xs">
        Um aviso na tela, para você baixar um backup e não perder o que já fez se houver uma falha.
      </p>
      <select
        id="backup-reminder"
        value={hours}
        disabled={isPending}
        onChange={(e) => handleChange(Number(e.target.value))}
        className="border-input h-9 rounded-lg border bg-transparent px-2.5 text-sm"
      >
        {BACKUP_REMINDER_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option === 0 ? "Não lembrar" : `A cada ${describeReminderInterval(option)}`}
          </option>
        ))}
      </select>
    </div>
  );
}

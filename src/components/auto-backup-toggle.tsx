"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toggleAutoBackup } from "@/core/backup-actions";

export function AutoBackupToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  function handleChange(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      const result = await toggleAutoBackup(next);
      if (!result.ok) {
        setEnabled(!next);
        toast.error("Não foi possível salvar essa configuração.");
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor="auto-backup">Backup automático diário</Label>
        <p className="text-muted-foreground text-xs">
          Todo dia, sem precisar lembrar. Ligado por padrão.
        </p>
      </div>
      <Switch
        id="auto-backup"
        checked={enabled}
        onCheckedChange={handleChange}
        disabled={isPending}
      />
    </div>
  );
}

"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackupDownloadButton } from "@/components/backup-download-button";
import { describeReminderInterval } from "@/core/backup-reminder";

/**
 * Lembrete para o responsável baixar um backup. Aparece quando o servidor diz que
 * passou do intervalo escolhido (`due`) — o próprio lembrete explica por que vale
 * a pena e que a frequência pode ser mudada em Backup. "Lembrar mais tarde" o
 * esconde, neste aparelho, pelo mesmo intervalo; baixar o backup o remove na hora
 * (o servidor registra e a tela atualiza).
 */
export function BackupReminder({
  due,
  reminderHours,
  lastDownloadLabel,
  organizationId,
}: {
  due: boolean;
  reminderHours: number;
  /** "Último backup baixado em 07/10/2026 14:02" ou null se nunca baixou. */
  lastDownloadLabel: string | null;
  organizationId: string;
}) {
  const pathname = usePathname();
  const snoozeKey = `backup-reminder-snooze:${organizationId}`;
  const snoozed = useSyncExternalStore(
    subscribeToStorage,
    () => isSnoozed(snoozeKey),
    () => true,
  );

  if (!due || snoozed || pathname.startsWith("/backup")) return null;

  function snooze() {
    try {
      localStorage.setItem(snoozeKey, String(Date.now() + reminderHours * 3_600_000));
    } catch {
      // Sem armazenamento (aba privada): o lembrete volta no próximo carregamento.
    }
    window.dispatchEvent(new Event(SNOOZE_EVENT));
  }

  return (
    <div
      role="region"
      aria-label="Lembrete de backup"
      className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-500/50 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-50 print:hidden"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="font-semibold">Hora de fazer um backup dos seus dados</p>
          <p>
            Se acontecer uma falha no sistema, o backup é o que garante que você não perde o que já
            foi cadastrado e feito. É rápido: baixe o arquivo e guarde no Google Drive, no WhatsApp
            ou no computador.
          </p>
          <p className="text-xs opacity-80">
            {lastDownloadLabel ?? "Você ainda não baixou nenhum backup."}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <BackupDownloadButton />
        <Button variant="outline" onClick={snooze}>
          Lembrar mais tarde
        </Button>
      </div>
      <p className="text-xs opacity-80">
        Você recebe este lembrete a cada {describeReminderInterval(reminderHours)}. Para mudar a
        frequência ou desligar, abra{" "}
        <Link href="/backup#lembrete" className="underline">
          Backup → Lembrete de backup
        </Link>
        .
      </p>
    </div>
  );
}

const SNOOZE_EVENT = "backup-reminder-snooze";

function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(SNOOZE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SNOOZE_EVENT, callback);
  };
}

function isSnoozed(key: string): boolean {
  try {
    const until = Number(localStorage.getItem(key));
    return until > Date.now();
  } catch {
    return false;
  }
}

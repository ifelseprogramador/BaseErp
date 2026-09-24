"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { APP_VERSION, CHANGELOG, type ChangeType } from "@/core/changelog";

const LAST_SEEN_KEY = "baseerp:last-seen-version";

const TYPE_META: Record<ChangeType, { label: string; className: string }> = {
  novo: {
    label: "Novo",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  },
  melhoria: {
    label: "Melhoria",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  },
  correcao: {
    label: "Correção",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  },
};

function formatChangelogDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Selo "vX.Y.Z" discreto no canto do menu. Clique abre o histórico de
 * versões (`core/changelog.ts`). Uma bolinha aparece enquanto a pessoa
 * ainda não abriu o histórico desde a última atualização — some ao
 * abrir. Guardado em `localStorage` (conveniência por navegador; se não
 * der pra ler/gravar, só não mostra a bolinha).
 */
export function VersionBadge({ className }: { className?: string }) {
  const [hasUnseen, setHasUnseen] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasUnseen(localStorage.getItem(LAST_SEEN_KEY) !== APP_VERSION);
    } catch {
      // modo privado/armazenamento bloqueado: segue sem a bolinha.
    }
  }, []);

  function handleOpenChange(open: boolean) {
    if (!open) return;
    setHasUnseen(false);
    try {
      localStorage.setItem(LAST_SEEN_KEY, APP_VERSION);
    } catch {
      // idem acima.
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <button
            type="button"
            title="Ver o que mudou"
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
              className,
            )}
          />
        }
      >
        <History className="h-3 w-3" />v{APP_VERSION}
        {hasUnseen && (
          <span className="bg-primary absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full" />
        )}
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogHeader className="flex-row items-center gap-2 border-b p-4">
          <DialogClose
            render={<Button variant="ghost" size="icon-sm" aria-label="Voltar" title="Voltar" />}
          >
            <ArrowLeft className="h-4 w-4" />
          </DialogClose>
          <div className="flex flex-col gap-1">
            <DialogTitle>O que mudou</DialogTitle>
            <DialogDescription>Você está na versão {APP_VERSION}.</DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          {CHANGELOG.map((entry, index) => (
            <details
              key={entry.version}
              open={index === 0}
              className="group rounded-lg border [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="hover:bg-muted/50 flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2">
                <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
                <span className="font-semibold">v{entry.version}</span>
                <span className="text-muted-foreground text-xs">
                  {formatChangelogDate(entry.date)}
                </span>
                {index === 0 && (
                  <span className="bg-primary text-primary-foreground ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium">
                    Atual
                  </span>
                )}
              </summary>
              <ul className="flex flex-col gap-1.5 px-3 pt-1 pb-3">
                {entry.changes.map((change) => {
                  const meta = TYPE_META[change.type];
                  return (
                    <li key={change.text} className="flex items-start gap-2 text-sm">
                      <span
                        className={cn(
                          "mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                          meta.className,
                        )}
                      >
                        {meta.label}
                      </span>
                      <span>{change.text}</span>
                    </li>
                  );
                })}
              </ul>
            </details>
          ))}
        </div>

        <div className="border-t p-3">
          <DialogClose render={<Button variant="outline" className="w-full" />}>Fechar</DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

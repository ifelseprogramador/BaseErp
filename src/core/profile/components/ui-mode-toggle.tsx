"use client";

import { useState, useTransition } from "react";
import { LayoutGrid, Table2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setUiMode } from "@/core/profile/actions";
import { UI_MODE_HINTS, UI_MODE_LABELS, type UiMode } from "@/core/ui-mode";
import { useRouter } from "next/navigation";

const OPTIONS = [
  { value: "formal", icon: Table2 },
  { value: "facil", icon: LayoutGrid },
] as const;

/**
 * Escolha do modo de interface. Diferente do tema (só localStorage), esta
 * preferência vai para o banco e acompanha a pessoa em qualquer aparelho.
 * Os dois cartões são grandes de propósito: quem mais precisa do modo
 * Simples precisa conseguir achar e tocar nele.
 */
export function UiModeToggle({ initialMode }: { initialMode: UiMode }) {
  const [mode, setMode] = useState<UiMode>(initialMode);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: UiMode) {
    if (next === mode) return;
    const previous = mode;
    setMode(next);
    startTransition(async () => {
      const result = await setUiMode(next);
      if (!result.ok) {
        setMode(previous);
        toast.error(result.message ?? "Não foi possível salvar. Tente novamente.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Modo de tela">
      {OPTIONS.map(({ value, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          disabled={pending}
          onClick={() => choose(value)}
          className={cn(
            "flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all",
            "hover:scale-[1.02] active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:scale-100",
            mode === value
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50",
          )}
        >
          <span className="bg-primary/10 text-primary rounded-lg p-3">
            <Icon className="h-6 w-6" />
          </span>
          <span className="flex flex-col">
            <span className="font-semibold">{UI_MODE_LABELS[value]}</span>
            <span className="text-muted-foreground text-xs">{UI_MODE_HINTS[value]}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

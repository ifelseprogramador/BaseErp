"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { LayoutGrid, Moon, Sun, Table2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setUiMode } from "@/core/profile/actions";
import { UI_MODE_LABELS, type UiMode } from "@/core/ui-mode";

/**
 * Acesso rápido, no topo de toda tela, às duas preferências que mais se
 * trocam: claro/escuro (só neste navegador) e o modo de tela (Clássico ↔
 * Simples, salvo na conta). O ícone do tema troca por CSS (`dark:`), sem
 * estado de "montado", para não dar diferença na hidratação.
 */
export function QuickPrefs({ uiMode }: { uiMode: UiMode }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mode, setMode] = useState<UiMode>(uiMode);
  const [pending, startTransition] = useTransition();

  const next: UiMode = mode === "facil" ? "formal" : "facil";
  const NextIcon = next === "facil" ? LayoutGrid : Table2;

  function switchMode() {
    const previous = mode;
    setMode(next);
    startTransition(async () => {
      const result = await setUiMode(next);
      if (!result.ok) {
        setMode(previous);
        toast.error(result.message ?? "Não foi possível trocar o modo de tela.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Alternar entre tema claro e escuro"
        title="Tema claro / escuro"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      >
        <Sun className="h-4 w-4 dark:hidden" />
        <Moon className="hidden h-4 w-4 dark:block" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={switchMode}
        title={`Trocar para o modo ${UI_MODE_LABELS[next]}`}
        className="gap-2"
      >
        <NextIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Modo {UI_MODE_LABELS[next]}</span>
      </Button>
    </div>
  );
}

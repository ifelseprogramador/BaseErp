"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

/**
 * Preferência de tema — vive só no navegador (`next-themes` +
 * localStorage), sem persistir no backend: é conveniência de aparência,
 * não um dado que precise seguir a pessoa entre dispositivos.
 *
 * Sem estado de "mounted" próprio: `useTheme()` já devolve `theme`
 * `undefined` durante SSR/primeira renderização no cliente (igual nos
 * dois lados, sem mismatch de hidratação) e só passa a refletir o valor
 * real depois que o `ThemeProvider` (`components/theme-provider.tsx`)
 * monta — nesse momento ele mesmo dispara o re-render.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="inline-flex gap-1 rounded-md border p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant={theme === value ? "secondary" : "ghost"}
          onClick={() => setTheme(value)}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Button>
      ))}
    </div>
  );
}

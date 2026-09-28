"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Liga o dark mode (classe `.dark` já existente em globals.css) via
 * `next-themes` — persiste no localStorage do navegador, sem flash
 * (FOUC). Ver `core/profile/components/theme-toggle.tsx` para o
 * seletor dentro do Perfil. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}

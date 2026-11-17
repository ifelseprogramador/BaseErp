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
      // React 19 avisa "Encountered a script tag while rendering React component" quando o
      // `next-themes` renderiza o <script> anti-flash NO NAVEGADOR (aviso só de desenvolvimento).
      // No servidor o script é normal e roda; no cliente ele já rodou, então vira JSON inerte
      // (o <script> do `next-themes` tem `suppressHydrationWarning`, sem erro de hidratação).
      scriptProps={typeof window === "undefined" ? undefined : { type: "application/json" }}
    >
      {children}
    </NextThemesProvider>
  );
}

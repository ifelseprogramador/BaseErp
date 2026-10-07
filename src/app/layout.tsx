import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StaleServiceWorkerCleanup } from "@/components/stale-service-worker-cleanup";
import { ThemeProvider } from "@/components/theme-provider";
import { BRAND } from "@/core/brand";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Nome/slogan vêm de `core/brand.ts` — é o que aparece ao compartilhar
// um link (WhatsApp, Slack, etc., via `openGraph`/`twitter` abaixo e
// `opengraph-image.tsx`), então esta declaração de metadata fica
// idêntica entre o BaseERP e cada vertical.
export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.tagline,
  openGraph: {
    title: BRAND.name,
    description: BRAND.tagline,
    type: "website",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.name,
    description: BRAND.tagline,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* `suppressHydrationWarning`: extensões do navegador (ColorZilla, gerenciadores de
            senha, tradutores) injetam atributos no <body> antes de o React assumir e
            geravam um aviso de hidratação que não é bug do sistema. */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <ThemeProvider>
          <StaleServiceWorkerCleanup />
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster richColors position="top-right" closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}

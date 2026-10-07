"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Cartão do painel admin que abre e fecha ao clicar no título. Começa RECOLHIDO
 * (a ficha de uma empresa tem muitos blocos; o dono da plataforma abre só o que
 * precisa). O conteúdo continua montado quando recolhido (só fica oculto), então
 * formulários não perdem o que foi digitado e o suporte ao vivo não desconecta.
 * `actions` aparece ao lado do título só com o cartão aberto.
 */
export function CollapsibleCard({
  title,
  defaultOpen = false,
  actions,
  className,
  titleClassName,
  contentClassName,
  children,
}: {
  title: React.ReactNode;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <Card className={className}>
      <CardHeader className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 transition-transform", !open && "-rotate-90")}
            aria-hidden
          />
          <CardTitle className={cn("truncate", titleClassName)}>{title}</CardTitle>
        </button>
        {open && actions}
      </CardHeader>
      <CardContent id={contentId} hidden={!open} className={contentClassName}>
        {children}
      </CardContent>
    </Card>
  );
}

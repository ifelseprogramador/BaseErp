"use client";

import Link from "next/link";
import { useState } from "react";
import { Home, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FacilGrid } from "@/components/layout/facil-grid";
import type { ModuleDefinition } from "@/core/registry";

/**
 * Navegação do modo Fácil (no lugar da barra lateral): botão grande
 * "Início" e botão "Todos os módulos", que abre uma folha com todos os
 * módulos liberados para a pessoa — o atalho para ir direto a qualquer um,
 * de qualquer tela.
 */
export function FacilNav({ modules, isOwner }: { modules: ModuleDefinition[]; isOwner: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/"
        className="bg-primary text-primary-foreground inline-flex h-12 items-center gap-2 rounded-full px-5 text-base font-semibold transition-transform hover:scale-105 active:scale-95 motion-reduce:transition-none"
      >
        <Home className="h-5 w-5" />
        Início
      </Link>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant="outline"
              className="h-12 gap-2 rounded-full px-5 text-base font-semibold"
            />
          }
        >
          <LayoutGrid className="h-5 w-5" />
          Todos os módulos
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="overflow-y-auto rounded-t-3xl p-5 data-[side=bottom]:h-[85vh]"
        >
          <SheetHeader className="p-0">
            <SheetTitle className="text-2xl">Para onde você quer ir?</SheetTitle>
          </SheetHeader>
          <FacilGrid
            modules={modules}
            isOwner={isOwner}
            size="painel"
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { VersionBadge } from "@/components/version-badge";
import type { ModuleDefinition } from "@/core/registry";

export function MobileNav({ modules }: { modules: ModuleDefinition[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </Button>
        }
      />
      <SheetContent
        side="left"
        className="bg-sidebar text-sidebar-foreground border-sidebar-border w-64 p-0"
      >
        <SheetHeader className="border-sidebar-border border-b px-4 py-3">
          <SheetTitle className="text-sidebar-foreground">BaseERP</SheetTitle>
        </SheetHeader>
        <SidebarNav modules={modules} onNavigate={() => setOpen(false)} />
        <div className="border-sidebar-border mt-auto border-t px-2 py-2">
          <VersionBadge className="text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground" />
        </div>
      </SheetContent>
    </Sheet>
  );
}

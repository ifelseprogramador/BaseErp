"use client";

import { ChevronDown, Download, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Menu "Planilha" das listas: importar e exportar (.xlsx ou .csv). Igual
 * em todo cadastro; cada página só passa as rotas.
 */
export function SpreadsheetMenu({
  importHref,
  exportHref,
}: {
  importHref: string;
  /** Rota de exportação; aceita `?formato=csv`. */
  exportHref: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        <FileSpreadsheet className="h-4 w-4" />
        Planilha
        <ChevronDown className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Importar / exportar</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<a href={importHref} />}>
            <Upload className="h-4 w-4" />
            Importar de uma planilha
          </DropdownMenuItem>
          <DropdownMenuItem render={<a href={exportHref} download />}>
            <Download className="h-4 w-4" />
            Exportar para Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem render={<a href={`${exportHref}?formato=csv`} download />}>
            <Download className="h-4 w-4" />
            Exportar para CSV
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

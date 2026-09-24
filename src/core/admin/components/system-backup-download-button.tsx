"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Baixa o backup de TODAS as organizações da plataforma
 * (`GET /admin/backup/exportar`) — só o dono da plataforma vê este botão
 * (dentro de `/admin`). Diferente de `BackupDownloadButton` (backup de
 * UMA organização, em `(app)/backup`), este não oferece Web Share — é um
 * arquivo grande, de uso administrativo/operacional, não algo que o
 * dono da plataforma normalmente encaminharia pelo celular.
 */
export function SystemBackupDownloadButton() {
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    setIsLoading(true);
    try {
      const response = await fetch("/admin/backup/exportar");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const filename =
        response.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
        "baseerp-backup-sistema.json";
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Não foi possível gerar o backup. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button onClick={handleClick} disabled={isLoading}>
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {isLoading ? "Gerando backup..." : "Baixar backup do sistema"}
    </Button>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Baixa o backup (`GET /backup/exportar`) e, quando o navegador suporta
 * a Web Share API (a maioria dos navegadores de celular — Chrome/Safari
 * Android e iOS), abre o seletor NATIVO do sistema operacional: a pessoa
 * escolhe salvar no Google Drive, mandar por WhatsApp/e-mail, guardar
 * nos Arquivos, qualquer app instalado. Sem isso disponível (a maioria
 * dos navegadores de desktop), cai pra um download comum — cobre os
 * três jeitos pedidos (nuvem, máquina, compartilhar) sem depender de
 * nenhum serviço de nuvem específico nem credencial nenhuma.
 */
export function BackupDownloadButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    // `navigator` não existe no render do servidor — só sabe se o
    // dispositivo suporta compartilhamento depois de montar no cliente,
    // senão o ícone divergiria entre o HTML do servidor e a hidratação.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleClick() {
    setIsLoading(true);
    let blob: Blob;
    let filename = "baseerp-backup.json";
    try {
      const response = await fetch("/backup/exportar");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      filename =
        response.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? filename;
      blob = await response.blob();
    } catch {
      // Só aqui é uma falha de verdade — o backup em si não foi gerado.
      toast.error("Não foi possível gerar o backup. Tente novamente.");
      setIsLoading(false);
      return;
    }

    // Daqui pra baixo o arquivo JÁ EXISTE — compartilhar é só um "a mais".
    // `await fetch()` acima consome a "ativação transitória" que o clique
    // deu (em vários navegadores, `navigator.share()` só funciona chamado
    // BEM perto do clique de verdade); em vez de tratar isso como erro,
    // qualquer falha no compartilhamento cai pro download comum — a
    // pessoa nunca fica sem o arquivo por causa de um detalhe do
    // navegador que ela nem sabe que existe.
    try {
      const file = new File([blob], filename, { type: "application/json" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Backup BaseERP",
          text: "Backup dos dados da organização.",
        });
        setIsLoading(false);
        return;
      }
    } catch (err) {
      // Cancelar o seletor de compartilhamento (AbortError) não é falha —
      // só não faz nada. Qualquer outro erro cai pro download abaixo.
      if (err instanceof Error && err.name === "AbortError") {
        setIsLoading(false);
        return;
      }
    }

    downloadBlob(blob, filename);
    setIsLoading(false);
  }

  return (
    <Button onClick={handleClick} disabled={isLoading}>
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : canShare ? (
        <Share2 className="h-4 w-4" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {isLoading ? "Gerando backup..." : "Baixar / compartilhar backup"}
    </Button>
  );
}

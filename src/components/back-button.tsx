"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Seta pra voltar pra onde a pessoa veio (`router.back()` — histórico de
 * navegação de verdade, não um link fixo pra lista) — usado no topo de
 * toda página de criar/editar registro. Não confundir com o botão
 * "Cancelar" de um dialog: aqui é navegação de página inteira.
 *
 * Com `href`, vai sempre pra esse destino fixo em vez do histórico — pra
 * telas cujo "voltar" tem um lugar certo (ex.: páginas do dono voltam
 * pra tela inicial `/admin`), mesmo se a pessoa chegou por um link
 * direto ou pelo menu do topo.
 */
export function BackButton({ href }: { href?: string }) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      title="Voltar"
      aria-label="Voltar"
      {...(href
        ? { nativeButton: false, render: <Link href={href} /> }
        : { onClick: () => router.back() })}
    >
      <ArrowLeft className="h-4 w-4" />
    </Button>
  );
}

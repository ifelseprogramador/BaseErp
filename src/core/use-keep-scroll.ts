"use client";

import { useCallback, useLayoutEffect, useRef, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Troca os parâmetros da URL (filtro, ordem, busca) SEM perder o ponto da tela onde a pessoa
 * está. A lista é renderizada no servidor, então cada mudança busca a página de novo; o
 * navegador/Next pode então mandar a tela de volta ao topo (ou ela encolhe e o scroll é
 * "puxado"). Aqui guardamos o `scrollY` antes de navegar e o devolvemos assim que o conteúdo
 * novo entra, na mesma pintura (`useLayoutEffect`), então não há salto nem piscada. A transição
 * mantém a lista antiga na tela até a nova chegar. `pending` serve para um aviso discreto.
 */
export function useKeepScroll() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const salvo = useRef<number | null>(null);

  const navegar = useCallback(
    (query: string) => {
      salvo.current = window.scrollY;
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [router, pathname],
  );

  // Roda quando a URL muda ou a transição termina: o conteúdo novo já está no DOM.
  useLayoutEffect(() => {
    if (salvo.current === null || pending) return;
    const y = salvo.current;
    salvo.current = null;
    window.scrollTo(0, y);
    // Imagens/fontes podem ainda mexer na altura no quadro seguinte.
    requestAnimationFrame(() => window.scrollTo(0, y));
  }, [searchParams, pending]);

  return { navegar, pending, searchParams };
}

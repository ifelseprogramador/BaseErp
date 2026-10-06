"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const MARGIN = 8;
const KEY_STEP = 16;

/**
 * Caixa flutuante que a pessoa arrasta pela barra de título para qualquer
 * lugar da tela (mouse, toque ou setas do teclado com a barra focada) —
 * a conversa do suporte não pode cobrir justamente o que a pessoa precisa
 * ver. Sem posição escolhida, fica ancorada pelas classes de `className`
 * (ex.: `right-4 bottom-4`); ao arrastar, passa a usar `left/top` e nunca
 * sai da janela. Elementos com `data-no-drag` dentro do cabeçalho (ex.: o
 * botão de recolher) continuam clicáveis sem iniciar o arrasto.
 */
export function DraggablePanel({
  header,
  children,
  className,
}: {
  header: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const grab = useRef<{ dx: number; dy: number } | null>(null);

  const clamp = useCallback((x: number, y: number) => {
    const el = ref.current;
    const width = el?.offsetWidth ?? 0;
    const height = el?.offsetHeight ?? 0;
    return {
      x: Math.min(Math.max(MARGIN, x), Math.max(MARGIN, window.innerWidth - width - MARGIN)),
      y: Math.min(Math.max(MARGIN, y), Math.max(MARGIN, window.innerHeight - height - MARGIN)),
    };
  }, []);

  // Janela redimensionada ou caixa que cresce/encolhe (recolher/expandir):
  // mantém a caixa inteira dentro da tela.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reclamp = () => setPos((p) => (p ? clamp(p.x, p.y) : p));
    const observer = new ResizeObserver(reclamp);
    observer.observe(el);
    window.addEventListener("resize", reclamp);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", reclamp);
    };
  }, [clamp]);

  function currentPosition() {
    const rect = ref.current?.getBoundingClientRect();
    return { x: rect?.left ?? MARGIN, y: rect?.top ?? MARGIN };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    const start = currentPosition();
    grab.current = { dx: e.clientX - start.x, dy: e.clientY - start.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setPos(start);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!grab.current) return;
    setPos(clamp(e.clientX - grab.current.dx, e.clientY - grab.current.dy));
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    grab.current = null;
    // `?.`: nem todo ambiente (testes em jsdom, navegadores antigos) tem captura
    // de ponteiro — sem ela o arrasto ainda funciona, só pode "soltar" fora.
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    };
    const move = delta[e.key];
    if (!move) return;
    e.preventDefault();
    const base = pos ?? currentPosition();
    setPos(clamp(base.x + move[0], base.y + move[1]));
  }

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined}
    >
      <div
        role="group"
        tabIndex={0}
        aria-label="Barra da conversa. Arraste para mover, ou use as setas do teclado."
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        className="flex cursor-grab touch-none items-center gap-1 select-none active:cursor-grabbing"
      >
        <GripHorizontal className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">{header}</div>
      </div>
      {children}
    </div>
  );
}

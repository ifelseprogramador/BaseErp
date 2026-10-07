"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const MARGIN = 8;
const KEY_STEP = 16;
export const PANEL_MIN_WIDTH = 240;
export const PANEL_MIN_HEIGHT = 220;

type Corner = "tl" | "br";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Caixa flutuante que a pessoa ARRASTA pela barra de título para qualquer
 * lugar da tela e REDIMENSIONA pelos cantos superior-esquerdo e
 * inferior-direito (mouse, toque ou setas do teclado com a alça focada) — a
 * conversa do suporte não pode cobrir justamente o que a pessoa precisa
 * ver, e quem digita muito quer uma caixa maior. Sem posição escolhida, fica
 * ancorada pelas classes de `className` (ex.: `right-4 bottom-4`); ao
 * arrastar/redimensionar, passa a usar `left/top/width/height` e nunca sai
 * da janela. Elementos com `data-no-drag` dentro do cabeçalho (ex.: o botão
 * de recolher) continuam clicáveis sem iniciar o arrasto. `collapsed` ignora
 * a altura escolhida (a caixa encolhe até o cabeçalho) e esconde as alças.
 */
export function DraggablePanel({
  header,
  children,
  className,
  collapsed = false,
}: {
  header: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  collapsed?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const grab = useRef<{ dx: number; dy: number } | null>(null);
  const resizing = useRef<{ corner: Corner; startX: number; startY: number; box: Box } | null>(
    null,
  );

  const clampPosition = useCallback((x: number, y: number) => {
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
    const reclamp = () => {
      setPos((p) => (p ? clampPosition(p.x, p.y) : p));
      setSize((s) =>
        s
          ? {
              w: Math.min(s.w, Math.max(PANEL_MIN_WIDTH, window.innerWidth - 2 * MARGIN)),
              h: Math.min(s.h, Math.max(PANEL_MIN_HEIGHT, window.innerHeight - 2 * MARGIN)),
            }
          : s,
      );
    };
    const observer = new ResizeObserver(reclamp);
    observer.observe(el);
    window.addEventListener("resize", reclamp);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", reclamp);
    };
  }, [clampPosition]);

  function currentBox(): Box {
    const rect = ref.current?.getBoundingClientRect();
    return {
      x: rect?.left ?? MARGIN,
      y: rect?.top ?? MARGIN,
      w: rect?.width ?? PANEL_MIN_WIDTH,
      h: rect?.height ?? PANEL_MIN_HEIGHT,
    };
  }

  /** Novo retângulo ao puxar `corner` por (dx, dy), respeitando mínimo e janela. */
  function resizedBox(corner: Corner, box: Box, dx: number, dy: number): Box {
    const right = box.x + box.w;
    const bottom = box.y + box.h;
    if (corner === "br") {
      const w = Math.min(Math.max(PANEL_MIN_WIDTH, box.w + dx), window.innerWidth - MARGIN - box.x);
      const h = Math.min(
        Math.max(PANEL_MIN_HEIGHT, box.h + dy),
        window.innerHeight - MARGIN - box.y,
      );
      return {
        x: box.x,
        y: box.y,
        w: Math.max(PANEL_MIN_WIDTH, w),
        h: Math.max(PANEL_MIN_HEIGHT, h),
      };
    }
    const w = Math.min(Math.max(PANEL_MIN_WIDTH, box.w - dx), right - MARGIN);
    const h = Math.min(Math.max(PANEL_MIN_HEIGHT, box.h - dy), bottom - MARGIN);
    return { x: right - w, y: bottom - h, w, h };
  }

  function applyBox(box: Box) {
    setPos({ x: box.x, y: box.y });
    setSize({ w: box.w, h: box.h });
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    const start = currentBox();
    grab.current = { dx: e.clientX - start.x, dy: e.clientY - start.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setPos({ x: start.x, y: start.y });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!grab.current) return;
    setPos(clampPosition(e.clientX - grab.current.dx, e.clientY - grab.current.dy));
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
    const base = pos ?? currentBox();
    setPos(clampPosition(base.x + move[0], base.y + move[1]));
  }

  function handleResizeDown(corner: Corner, e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.stopPropagation();
    const box = currentBox();
    resizing.current = { corner, startX: e.clientX, startY: e.clientY, box };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    applyBox(box);
  }

  function handleResizeMove(e: React.PointerEvent<HTMLDivElement>) {
    const r = resizing.current;
    if (!r) return;
    applyBox(resizedBox(r.corner, r.box, e.clientX - r.startX, e.clientY - r.startY));
  }

  function handleResizeUp(e: React.PointerEvent<HTMLDivElement>) {
    resizing.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function handleResizeKey(corner: Corner, e: React.KeyboardEvent<HTMLDivElement>) {
    // Seta para fora do canto = maior; para dentro = menor.
    const sign = corner === "br" ? 1 : -1;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP * sign, 0],
      ArrowRight: [KEY_STEP * sign, 0],
      ArrowUp: [0, -KEY_STEP * sign],
      ArrowDown: [0, KEY_STEP * sign],
    };
    const move = delta[e.key];
    if (!move) return;
    e.preventDefault();
    applyBox(resizedBox(corner, currentBox(), move[0], move[1]));
  }

  const style: React.CSSProperties = {};
  if (pos) Object.assign(style, { left: pos.x, top: pos.y, right: "auto", bottom: "auto" });
  if (size) {
    style.width = size.w;
    style.maxWidth = "none";
    if (!collapsed) style.height = size.h;
  }

  return (
    <div ref={ref} className={cn(className)} style={style}>
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
      {!collapsed && (
        <>
          <ResizeHandle
            corner="tl"
            onPointerDown={(e) => handleResizeDown("tl", e)}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeUp}
            onKeyDown={(e) => handleResizeKey("tl", e)}
          />
          <ResizeHandle
            corner="br"
            onPointerDown={(e) => handleResizeDown("br", e)}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeUp}
            onKeyDown={(e) => handleResizeKey("br", e)}
          />
        </>
      )}
    </div>
  );
}

/** Alça de um canto da caixa (ver `DraggablePanel`): pointer events + teclado. */
function ResizeHandle({
  corner,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onKeyDown,
}: {
  corner: Corner;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      tabIndex={0}
      data-resize-handle={corner}
      aria-label={
        corner === "br"
          ? "Redimensionar pelo canto inferior direito. Use as setas do teclado."
          : "Redimensionar pelo canto superior esquerdo. Use as setas do teclado."
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      className={cn(
        "absolute z-10 h-4 w-4 cursor-nwse-resize touch-none rounded-sm opacity-40 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2",
        corner === "br"
          ? "right-0 bottom-0 border-r-2 border-b-2 border-current"
          : "top-0 left-0 border-t-2 border-l-2 border-current",
      )}
    />
  );
}

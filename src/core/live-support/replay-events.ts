/**
 * Eventos do rrweb que o espelho deve IGNORAR. Quando a pessoa troca de aba ou
 * minimiza o navegador, alguns navegadores informam janela de tamanho 0 — o rrweb
 * grava isso como um `Meta`/`ViewportResize` 0×0 e o espelho encolheria para
 * nada (ficava branco). Sem tamanho real, o último quadro bom continua na tela.
 */
const EVENT_TYPE_INCREMENTAL = 3;
const EVENT_TYPE_META = 4;
const SOURCE_VIEWPORT_RESIZE = 4;

interface LooseEvent {
  type?: number;
  data?: { width?: number; height?: number; source?: number };
}

export function isDegenerateViewportEvent(event: unknown): boolean {
  const e = event as LooseEvent;
  const isMeta = e?.type === EVENT_TYPE_META;
  const isResize = e?.type === EVENT_TYPE_INCREMENTAL && e.data?.source === SOURCE_VIEWPORT_RESIZE;
  if (!isMeta && !isResize) return false;
  const { width, height } = e.data ?? {};
  return !(Number(width) > 0) || !(Number(height) > 0);
}

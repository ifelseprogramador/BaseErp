/**
 * Formato dos eventos de controle remoto (mouse/teclado) trocados durante
 * uma sessão ativa com `controlGranted`. Coordenadas são fração da tela
 * (0 a 1), não pixel — o viewport de quem está sendo controlado quase
 * nunca tem o mesmo tamanho do viewport de quem está vendo o replay.
 */
export type ControlEvent =
  | { type: "move"; xFrac: number; yFrac: number }
  | { type: "click"; xFrac: number; yFrac: number }
  | { type: "key"; key: string }
  /** Escolha de uma opção de um <select> nativo (cuja lista o navegador desenha
   * fora da página e por isso não aparece no espelho): o <select> está no ponto
   * (`xFrac`,`yFrac`) e `index` é a posição da opção escolhida. */
  | { type: "select"; xFrac: number; yFrac: number; index: number }
  /** Texto digitado no campo "Digitar na tela da pessoa" (celular): apaga
   * `deleteCount` caracteres do fim do campo focado e acrescenta `text`. */
  | { type: "text"; text: string; deleteCount: number }
  | { type: "scroll"; deltaX: number; deltaY: number }
  /** Caixa de conversa na tela da pessoa: recolher/expandir ou empurrar para um lado
   * (o alvo é pequeno e o arrasto não passa pelo espelho). */
  | { type: "panel"; action: "toggle" | "left" | "right" | "up" | "down" };

/**
 * O que mudou entre o texto anterior e o novo de um campo de digitação: quantos
 * caracteres do FIM foram apagados e o que foi acrescentado. Funciona para
 * digitar, apagar, colar e para teclados de celular que reescrevem a palavra
 * enquanto compõem (ex.: "cafe" → "café"): o campo remoto sempre termina igual
 * ao local. Compara pelo prefixo comum.
 */
export function computeTextDelta(
  previous: string,
  next: string,
): { deleteCount: number; text: string } {
  let common = 0;
  const limit = Math.min(previous.length, next.length);
  while (common < limit && previous[common] === next[common]) common += 1;
  return { deleteCount: previous.length - common, text: next.slice(common) };
}

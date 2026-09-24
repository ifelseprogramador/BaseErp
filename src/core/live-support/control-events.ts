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
  | { type: "scroll"; deltaX: number; deltaY: number };

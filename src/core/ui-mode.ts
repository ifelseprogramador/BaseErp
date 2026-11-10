/**
 * Modo de interface escolhido por cada pessoa: "formal" é o layout de
 * sempre (menu de texto, tabelas); "facil" troca o menu por botões grandes
 * com desenhos e liga animações leves, pensado para quem não tem
 * costume com sistemas. Persistido em `user_preferences` (por pessoa, não
 * por organização).
 */
export const UI_MODES = ["formal", "facil"] as const;
export type UiMode = (typeof UI_MODES)[number];

export const DEFAULT_UI_MODE: UiMode = "formal";

export function isUiMode(value: unknown): value is UiMode {
  return typeof value === "string" && (UI_MODES as readonly string[]).includes(value);
}

/**
 * Nomes que a PESSOA vê (os valores "formal"/"facil" são só o identificador
 * gravado no banco). Mudar o nome é só editar aqui.
 */
export const UI_MODE_LABELS: Record<UiMode, string> = {
  formal: "Clássico",
  facil: "Simples",
};

export const UI_MODE_HINTS: Record<UiMode, string> = {
  formal: "Menu ao lado e tabelas, como nos sistemas tradicionais.",
  facil: "Botões grandes com desenhos e passo a passo, sem menu lateral.",
};

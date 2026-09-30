/**
 * Modelo de mensagem editável (WhatsApp/e-mail) com variáveis. Puro e sem
 * `server-only`: usado pelo servidor (valores) e pelo botão (edição/prévia).
 * O usuário escolhe as variáveis por botões e vê a prévia pronta; nas
 * `{chaves}` só aparecem textos de fácil leitura.
 */
export const SHARE_VARS = [
  { key: "primeiro_nome", label: "Nome do cliente", example: "Maria" },
  { key: "nome", label: "Nome completo", example: "Maria Souza" },
  { key: "documento", label: "Tipo do documento", example: "orçamento" },
  { key: "numero", label: "Número", example: "42" },
  { key: "total", label: "Valor total", example: "R$ 350,00" },
  { key: "empresa", label: "Nome da empresa", example: "Bordados da Ana" },
  { key: "link", label: "Link do documento", example: "https://…/d/abc" },
] as const;

export type ShareVarKey = (typeof SHARE_VARS)[number]["key"];
export type ShareVars = Partial<Record<ShareVarKey, string>>;

export const DEFAULT_SHARE_TEMPLATE =
  "Olá, {primeiro_nome}! Segue o {documento} nº {numero} de {empresa}, no valor de {total}.\n{link}";

/** Troca `{variavel}` pelo valor; desconhecida/vazia some. Sem `{link}` no texto, o link vai ao final. */
export function renderShareTemplate(
  template: string,
  vars: ShareVars,
  options: { ensureLink?: boolean } = {},
): string {
  const hasLink = /\{link\}/.test(template);
  let text = template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k as ShareVarKey] ?? "");
  if ((options.ensureLink ?? true) && !hasLink && vars.link)
    text = `${text.trimEnd()}\n${vars.link}`;
  return text
    .replace(/ +([,.!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

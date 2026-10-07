/**
 * Descobre, na réplica da tela da pessoa (o iframe do espelho), o que há no ponto
 * tocado pelo dono: um campo de TEXTO editável (e o texto que ele já tem) ou
 * outra coisa (botão, link, texto solto). É o que decide se o teclado do celular
 * deve abrir e com qual conteúdo o campo de digitação começa.
 *
 * Os elementos do iframe são de OUTRO documento: `instanceof HTMLInputElement`
 * falha entre documentos, então tudo aqui é verificado por `tagName`/propriedades.
 */

/** `type` de <input> que recebem texto (os demais — checkbox, botão, arquivo… — não). */
const TEXT_INPUT_TYPES = new Set([
  "",
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "number",
]);

export interface ElementLike {
  tagName?: string;
  type?: string;
  value?: unknown;
  isContentEditable?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  textContent?: string | null;
  multiple?: boolean;
  size?: number;
  selectedIndex?: number;
  options?: ArrayLike<{ text?: string; label?: string; disabled?: boolean }>;
}

export interface SelectChoice {
  label: string;
  disabled: boolean;
}

export interface SelectField {
  options: SelectChoice[];
  selectedIndex: number;
}

/**
 * Um <select> comum (lista suspensa nativa)? O navegador desenha essa lista fora
 * da página, então ela nunca aparece no espelho: o dono precisa de uma lista
 * própria, montada a partir das opções do <select> da réplica.
 */
export function readSelectField(element: ElementLike | null | undefined): SelectField | null {
  if (!element || element.tagName?.toUpperCase() !== "SELECT") return null;
  if (element.disabled || element.multiple || (element.size ?? 0) > 1) return null;
  const options = Array.from(element.options ?? []).map((o) => ({
    label: (o.label || o.text || "").trim() || "(vazio)",
    disabled: Boolean(o.disabled),
  }));
  if (options.length === 0) return null;
  return { options, selectedIndex: element.selectedIndex ?? -1 };
}

export interface EditableField {
  /** Texto que o campo tem agora. */
  value: string;
}

/** O elemento é um campo onde dá para digitar? Devolve o texto atual, ou `null`. */
export function readEditableField(element: ElementLike | null | undefined): EditableField | null {
  if (!element) return null;
  const tag = element.tagName?.toUpperCase();

  if (tag === "TEXTAREA" || tag === "INPUT") {
    if (element.readOnly || element.disabled) return null;
    if (tag === "INPUT" && !TEXT_INPUT_TYPES.has((element.type ?? "").toLowerCase())) return null;
    return { value: typeof element.value === "string" ? element.value : "" };
  }

  // Editor de texto rico / campo contenteditable: há onde digitar, mas o texto
  // não é um `value` — o campo de digitação começa vazio.
  if (element.isContentEditable) return { value: "" };

  return null;
}

/**
 * Elemento sob o ponto (em fração da tela gravada) dentro do iframe do espelho.
 * `null` se o iframe ainda não existe ou o documento não está acessível.
 */
export function elementAtFraction(
  iframe: HTMLIFrameElement | null | undefined,
  xFrac: number,
  yFrac: number,
): ElementLike | null {
  const doc = iframe?.contentDocument;
  if (!iframe || !doc) return null;
  const width = Number(iframe.getAttribute("width")) || iframe.clientWidth;
  const height = Number(iframe.getAttribute("height")) || iframe.clientHeight;
  if (!width || !height) return null;
  return doc.elementFromPoint(xFrac * width, yFrac * height) as ElementLike | null;
}

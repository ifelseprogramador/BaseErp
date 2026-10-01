/**
 * Definição de uma coluna de planilha (importação/exportação). Cada módulo
 * descreve as suas; a fundação gera o modelo, lê o arquivo e mapeia os
 * cabeçalhos — tolerante a maiúsculas, acentos, "*" e sinônimos.
 */
export interface SheetColumn {
  /** Chave interna (também aceita como cabeçalho, p/ compatibilidade com CSV antigo). */
  key: string;
  /** Texto do cabeçalho na planilha, em português. */
  header: string;
  required?: boolean;
  /** Explicação curta mostrada na aba "Instruções" e como nota na célula. */
  hint: string;
  example: string;
  /** Lista de valores aceitos (vira lista suspensa no Excel/Sheets). */
  options?: string[];
  /** Outros nomes aceitos para o cabeçalho. */
  aliases?: string[];
  width?: number;
  /** Ajusta o valor lido (ex.: devolver zeros à esquerda que o Excel remove). */
  normalize?: (value: string) => string;
}

export class SpreadsheetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpreadsheetError";
  }
}

export const SPREADSHEET_LIMITS = { maxBytes: 5 * 1024 * 1024, maxRows: 5000 } as const;

/** minúsculas, sem acento, sem "*", "(opcional)" e pontuação. */
export function normalizeHeader(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]/g, "");
}

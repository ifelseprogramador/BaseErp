/** Estados devolvidos pelas Server Actions de importação (client-safe, sem "server-only"). */
export interface ImportIssue {
  /** Linha na planilha (cabeçalho = 1). */
  row: number;
  /** Quem é (ex.: nome do cliente) — ajuda a achar a linha. */
  label?: string;
  message: string;
}

export interface ImportPreview {
  ok: boolean;
  /** Erro geral (arquivo ilegível, coluna obrigatória ausente…). */
  message?: string;
  total: number;
  /** Linhas válidas que serão criadas. */
  ready: number;
  /** Linhas válidas que já existem no sistema (ou repetidas na planilha). */
  duplicates: number;
  /** Linhas com problema (não serão importadas). */
  errors: number;
  issues: ImportIssue[];
  /** Avisos que não impedem (ex.: colunas ignoradas). */
  warnings: string[];
  /** Primeiras linhas prontas, para a pessoa conferir. */
  sample: { row: number; label: string }[];
}

export interface ImportDone {
  ok: boolean;
  message?: string;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  issues: ImportIssue[];
}

export type DuplicateMode = "skip" | "update";

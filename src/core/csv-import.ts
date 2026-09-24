import "server-only";
import { parseCsv } from "./csv";

export interface CsvImportRowResult {
  /** Número da linha na planilha (1 = cabeçalho, então a primeira linha de dado é 2). */
  row: number;
  ok: boolean;
  message?: string;
}

export interface CsvImportSummary {
  totalRows: number;
  imported: number;
  results: CsvImportRowResult[];
}

export type CsvImportState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; summary: CsvImportSummary };

/**
 * Motor genérico de importação CSV, reaproveitado por toda `actions.ts`
 * de módulo que aceita importar. Processa SEQUENCIALMENTE (nunca em
 * paralelo): evita sobrecarregar o pool de conexões com um CSV grande, e
 * cada linha erra de forma isolada sem travar as outras (tudo-ou-nada
 * seria péssima UX pra corrigir um erro de digitação numa linha só).
 */
type ParsedRow<T> = { success: true; data: T } | { success: false; error: string };

export async function importCsvRows<T>(
  csvText: string,
  parseRow: (row: Record<string, string>) => ParsedRow<T> | Promise<ParsedRow<T>>,
  insertRow: (data: T) => Promise<{ ok: boolean; message?: string }>,
): Promise<CsvImportSummary> {
  const rows = parseCsv(csvText);
  const results: CsvImportRowResult[] = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // linha 1 é o cabeçalho
    const parsed = await parseRow(rows[i]);
    if (!parsed.success) {
      results.push({ row: rowNumber, ok: false, message: parsed.error });
      continue;
    }
    const inserted = await insertRow(parsed.data);
    if (inserted.ok) {
      imported++;
      results.push({ row: rowNumber, ok: true });
    } else {
      results.push({ row: rowNumber, ok: false, message: inserted.message ?? "Falha ao salvar." });
    }
  }

  return { totalRows: rows.length, imported, results };
}

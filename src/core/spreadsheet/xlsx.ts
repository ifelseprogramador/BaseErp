import "server-only";
import ExcelJS from "exceljs";
import { parseCsv } from "../csv";
import { SPREADSHEET_LIMITS, SpreadsheetError, normalizeHeader, type SheetColumn } from "./columns";

const INSTRUCTIONS_SHEET = "Instruções";

export interface SheetRow {
  /** Número da linha na planilha (cabeçalho = 1). */
  row: number;
  values: Record<string, string>;
}

export interface ReadSheetResult {
  rows: SheetRow[];
  /** Colunas obrigatórias que não foram encontradas no cabeçalho. */
  missingRequired: string[];
  /** Cabeçalhos do arquivo que não foram reconhecidos (ignorados). */
  unknownHeaders: string[];
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    const d = v.getUTCDate().toString().padStart(2, "0");
    const m = (v.getUTCMonth() + 1).toString().padStart(2, "0");
    return `${d}/${m}/${v.getUTCFullYear()}`;
  }
  if (typeof v === "object") {
    if ("richText" in v)
      return v.richText
        .map((r) => r.text)
        .join("")
        .trim();
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if ("text" in v) return String(v.text).trim();
    return "";
  }
  return String(v).trim();
}

function buildHeaderMap(headers: string[], columns: SheetColumn[]) {
  const lookup = new Map<string, SheetColumn>();
  for (const c of columns) {
    for (const name of [c.header, c.key, ...(c.aliases ?? [])])
      lookup.set(normalizeHeader(name), c);
  }
  const index = new Map<number, SheetColumn>();
  const unknown: string[] = [];
  headers.forEach((h, i) => {
    if (!h.trim()) return;
    const col = lookup.get(normalizeHeader(h));
    if (col && ![...index.values()].includes(col)) index.set(i, col);
    else if (!col) unknown.push(h.trim());
  });
  const found = new Set(index.values());
  return {
    index,
    unknown,
    missingRequired: columns.filter((c) => c.required && !found.has(c)).map((c) => c.header),
  };
}

function toResult(table: string[][], columns: SheetColumn[]): ReadSheetResult {
  // Cabeçalho = primeira linha não vazia (planilhas costumam ter linhas em branco no topo).
  const headerAt = table.findIndex((r) => r.some((c) => c.trim()));
  if (headerAt === -1) throw new SpreadsheetError("A planilha está vazia.");
  const { index, unknown, missingRequired } = buildHeaderMap(table[headerAt], columns);

  const rows: SheetRow[] = [];
  for (let i = headerAt + 1; i < table.length; i++) {
    const cells = table[i];
    if (!cells.some((c) => c.trim())) continue;
    const values: Record<string, string> = {};
    for (const [colIdx, col] of index) {
      const raw = (cells[colIdx] ?? "").trim();
      values[col.key] = col.normalize ? col.normalize(raw) : raw;
    }
    rows.push({ row: i + 1, values });
    if (rows.length > SPREADSHEET_LIMITS.maxRows) {
      throw new SpreadsheetError(
        `A planilha tem linhas demais. O máximo é ${SPREADSHEET_LIMITS.maxRows} por vez — divida em arquivos menores.`,
      );
    }
  }
  return { rows, missingRequired, unknownHeaders: unknown };
}

function decodeCsv(buffer: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    // CSV salvo pelo Excel em português costuma ser Windows-1252.
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

/** Lê .xlsx ou .csv (vírgula ou ponto e vírgula) e devolve linhas já mapeadas para as colunas. */
export async function readSheet(
  file: { name: string; buffer: Buffer },
  columns: SheetColumn[],
  sheetName: string,
): Promise<ReadSheetResult> {
  if (file.buffer.length === 0) throw new SpreadsheetError("O arquivo está vazio.");
  if (file.buffer.length > SPREADSHEET_LIMITS.maxBytes) {
    throw new SpreadsheetError("O arquivo é grande demais (máximo de 5 MB).");
  }
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const text = decodeCsv(file.buffer);
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    const delimiter =
      (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
    const parsed = parseCsv(text, delimiter);
    const headers = Object.keys(parsed[0] ?? {});
    if (headers.length === 0) throw new SpreadsheetError("A planilha está vazia.");
    return toResult([headers, ...parsed.map((r) => headers.map((h) => r[h] ?? ""))], columns);
  }
  if (!name.endsWith(".xlsx")) {
    throw new SpreadsheetError(
      "Formato não suportado. Envie um arquivo .xlsx ou .csv (no Excel: Arquivo › Salvar como › Pasta de Trabalho do Excel).",
    );
  }

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(file.buffer as unknown as ArrayBuffer);
  } catch {
    throw new SpreadsheetError(
      "Não consegui abrir este arquivo. Ele está corrompido ou protegido por senha?",
    );
  }
  const sheet =
    wb.worksheets.find((s) => normalizeHeader(s.name) === normalizeHeader(sheetName)) ??
    wb.worksheets.find((s) => normalizeHeader(s.name) !== normalizeHeader(INSTRUCTIONS_SHEET)) ??
    wb.worksheets[0];
  if (!sheet) throw new SpreadsheetError("A planilha está vazia.");

  const table: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: string[] = [];
    for (let c = 1; c <= Math.max(row.cellCount, columns.length); c++)
      cells.push(cellText(row.getCell(c).value));
    table[rowNumber - 1] = cells;
  });
  for (let i = 0; i < table.length; i++) table[i] ??= [];
  return toResult(table, columns);
}

function styleHeader(sheet: ExcelJS.Worksheet, columns: SheetColumn[]) {
  const row = sheet.getRow(1);
  columns.forEach((c, i) => {
    const cell = row.getCell(i + 1);
    cell.value = c.required ? `${c.header} *` : c.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: c.required ? "FFD97706" : "FF4B5563" },
    };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.note = c.hint;
    sheet.getColumn(i + 1).width = c.width ?? Math.max(14, c.header.length + 6);
  });
  row.height = 24;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
}

function addDropdowns(sheet: ExcelJS.Worksheet, columns: SheetColumn[], lastRow: number) {
  columns.forEach((c, i) => {
    if (!c.options?.length) return;
    const list = `"${c.options.join(",")}"`;
    if (list.length > 255) return;
    for (let r = 2; r <= lastRow; r++) {
      sheet.getCell(r, i + 1).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [list],
        showErrorMessage: true,
        errorTitle: "Valor inválido",
        error: "Escolha uma opção da lista.",
      };
    }
  });
}

/** Modelo para preencher: aba de instruções + aba de dados só com o cabeçalho (listas suspensas prontas). */
export async function buildTemplate(opts: {
  sheetName: string;
  title: string;
  columns: SheetColumn[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const help = wb.addWorksheet(INSTRUCTIONS_SHEET);
  help.getColumn(1).width = 26;
  help.getColumn(2).width = 14;
  help.getColumn(3).width = 70;
  help.getColumn(4).width = 28;
  help.addRow([opts.title]).font = { bold: true, size: 16 };
  help.addRow([]);
  for (const line of [
    `1. Vá para a aba "${opts.sheetName}" e preencha uma linha por registro, a partir da linha 2.`,
    "2. As colunas em laranja (com *) são obrigatórias; as cinzas são opcionais.",
    "3. Onde houver seta na célula, escolha uma opção da lista.",
    "4. Salve o arquivo e envie na tela de importação. Antes de gravar, o sistema mostra o que vai acontecer.",
  ]) {
    help.addRow([line]);
  }
  help.addRow([]);
  const head = help.addRow(["Coluna", "Obrigatória", "O que preencher", "Exemplo"]);
  head.font = { bold: true };
  head.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  });
  for (const c of opts.columns) {
    const r = help.addRow([c.header, c.required ? "Sim" : "Não", c.hint, c.example]);
    r.getCell(3).alignment = { wrapText: true, vertical: "top" };
  }

  const data = wb.addWorksheet(opts.sheetName);
  styleHeader(data, opts.columns);
  addDropdowns(data, opts.columns, 500);
  wb.views = [
    { x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, activeTab: 1, visibility: "visible" },
  ];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Exportação no MESMO formato do modelo (pode ser editada e importada de volta). */
export async function buildExport(opts: {
  sheetName: string;
  columns: SheetColumn[];
  rows: Record<string, string>[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(opts.sheetName);
  styleHeader(sheet, opts.columns);
  for (const row of opts.rows) {
    sheet.addRow(opts.columns.map((c) => row[c.key] ?? ""));
  }
  // Tudo como texto: o Excel não pode transformar CEP/telefone/CPF em número e comer o zero à esquerda.
  opts.columns.forEach((_, i) => {
    sheet.getColumn(i + 1).numFmt = "@";
  });
  addDropdowns(sheet, opts.columns, Math.max(opts.rows.length + 1, 2));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

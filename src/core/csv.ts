/**
 * CSV mínimo, sem dependência (RFC 4180: aspas duplas escapando aspas e
 * qualquer campo com vírgula/aspas/quebra de linha). Decisão: CSV é o
 * único formato de "planilha" que qualquer app (Excel, Google Sheets,
 * Numbers, LibreOffice) abre nativamente sem biblioteca nenhuma, então
 * não traz `xlsx`/`papaparse` só pra isso — ver docs/decisoes.md.
 */

export function toCsv(rows: Record<string, string>[], headers: string[]): string {
  const escape = (value: string) =>
    /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h] ?? "")).join(","));
  }
  // BOM UTF-8 na frente: Excel no Windows só detecta acentuação certa com
  // ele — sem isso "José" vira "JosÃ©" ao abrir um CSV com acento.
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseCsvRows(text.replace(/^﻿/, ""));
  if (rows.length === 0) return [];
  const [header, ...dataRows] = rows;
  return dataRows.map((row) => Object.fromEntries(header.map((h, i) => [h.trim(), row[i] ?? ""])));
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (char === "\r") {
      i++;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += char;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Linha em branco no fim do arquivo vira `[""]` — descarta.
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

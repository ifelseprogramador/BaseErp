import "server-only";
import { toCsv } from "../csv";
import { buildExport } from "./xlsx";
import type { SheetColumn } from "./columns";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Resposta de download de uma lista exportada: `.xlsx` (padrão) ou `.csv`
 * (`?formato=csv`). Igual para qualquer módulo; cada rota só monta as linhas.
 * Não usa a ordem ou os filtros da tela: quem chama decide o que exporta.
 */
export async function exportResponse(opts: {
  request: Request;
  /** Nome do arquivo sem extensão nem data, ex.: "catalogo". */
  fileBase: string;
  sheetName: string;
  columns: SheetColumn[];
  rows: Record<string, string>[];
}): Promise<Response> {
  const asCsv = new URL(opts.request.url).searchParams.get("formato") === "csv";
  const stamp = new Date().toISOString().slice(0, 10);

  if (asCsv) {
    const csv = toCsv(
      opts.rows.map((r) => Object.fromEntries(opts.columns.map((c) => [c.header, r[c.key] ?? ""]))),
      opts.columns.map((c) => c.header),
    );
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${opts.fileBase}-${stamp}.csv"`,
      },
    });
  }

  const file = await buildExport({
    sheetName: opts.sheetName,
    columns: opts.columns,
    rows: opts.rows,
  });
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="${opts.fileBase}-${stamp}.xlsx"`,
    },
  });
}

/** Resposta de download do modelo em branco (aba de instruções + listas suspensas). */
export function templateResponse(file: Buffer, fileName: string): Response {
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

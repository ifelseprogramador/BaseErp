import "server-only";
import { revalidatePath } from "next/cache";
import { requireModule } from "@/core/auth";
import type { Database } from "@/core/db";
import { SpreadsheetError, type SheetColumn } from "./columns";
import { readSheet } from "./xlsx";
import type { DuplicateMode, ImportDone, ImportIssue, ImportPreview } from "./types";

/**
 * Motor de importação por planilha para cadastros SIMPLES (uma tabela, sem
 * filhos): lê, valida tudo, mostra a prévia e só então grava. Cada módulo
 * descreve o que é específico (`ImportConfig`) e escreve duas Server Actions
 * finas que chamam `previewImport` / `confirmImport`.
 *
 * Regras (as mesmas de `clientes/import-actions.ts`):
 *  - nada grava antes da confirmação; a confirmação reenvia o arquivo e o
 *    servidor revalida tudo (não confia na prévia);
 *  - linha com erro nunca entra; repetida na própria planilha vira erro;
 *  - já existe (mesma `key`): pular ou atualizar, e célula em branco NÃO apaga
 *    o que já está no sistema;
 *  - novos entram em lotes de 100; se um lote falha, tenta linha a linha.
 */
export interface ImportConfig<TInput> {
  /** Slug do módulo (`requireModule`). */
  module: string;
  sheetName: string;
  columns: SheetColumn[];
  /** "produto", "serviço"… (só para mensagens). */
  entitySingular: string;
  /** Rota a revalidar depois de gravar, ex.: "/catalogo-revestimento". */
  revalidate: string;
  /** Nome do evento de log, ex.: "catalogo_revestimento.importar_planilha". */
  logEvent: string;
  /** Linha da planilha → entrada validada + chave de "já existe", ou mensagem de erro. */
  parseRow(
    values: Record<string, string>,
  ): { input: TInput; key: string; label: string } | { error: string; label?: string };
  /** Chaves dos registros que já existem na organização → id. */
  loadExisting(tx: Database, organizationId: string): Promise<Map<string, string>>;
  insertMany(tx: Database, organizationId: string, inputs: TInput[]): Promise<void>;
  /** Devolve false se o registro não existe mais. `raw` = valores crus da linha (para saber o que veio em branco). */
  updateOne(
    tx: Database,
    organizationId: string,
    id: string,
    input: TInput,
    raw: Record<string, string>,
  ): Promise<boolean>;
}

interface Entry<TInput> {
  row: number;
  label: string;
  status: "ready" | "duplicate" | "error";
  message?: string;
  input?: TInput;
  raw: Record<string, string>;
  existingId?: string;
}

const MAX_ISSUES = 200;
const CHUNK = 100;

async function analyze<TInput>(cfg: ImportConfig<TInput>, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    throw new SpreadsheetError("Selecione um arquivo.");

  const sheet = await readSheet(
    { name: file.name, buffer: Buffer.from(await file.arrayBuffer()) },
    cfg.columns,
    cfg.sheetName,
  );
  if (sheet.missingRequired.length > 0) {
    throw new SpreadsheetError(
      `Não encontrei a coluna ${sheet.missingRequired.map((c) => `"${c}"`).join(", ")}. Use o modelo para manter os nomes das colunas.`,
    );
  }
  if (sheet.rows.length === 0)
    throw new SpreadsheetError("A planilha não tem nenhuma linha preenchida.");

  const { organizationId, withDb } = await requireModule(cfg.module);
  const existing = await withDb((tx) => cfg.loadExisting(tx, organizationId));

  const seen = new Map<string, number>();
  const entries: Entry<TInput>[] = sheet.rows.map(({ row, values }) => {
    const parsed = cfg.parseRow(values);
    if ("error" in parsed) {
      return {
        row,
        label: parsed.label || values[cfg.columns[0].key] || `linha ${row}`,
        status: "error",
        message: parsed.error,
        raw: values,
      };
    }
    const { input, key, label } = parsed;
    const firstRow = seen.get(key);
    if (firstRow) {
      return {
        row,
        label,
        status: "error",
        message: `Repetido: já aparece na linha ${firstRow} desta planilha.`,
        raw: values,
      };
    }
    seen.set(key, row);
    const existingId = existing.get(key);
    if (existingId) return { row, label, status: "duplicate", input, existingId, raw: values };
    return { row, label, status: "ready", input, raw: values };
  });

  return { entries, unknownHeaders: sheet.unknownHeaders };
}

function failure(e: unknown): { ok: false; message: string } {
  return {
    ok: false,
    message:
      e instanceof SpreadsheetError ? e.message : "Não foi possível ler a planilha. Tente de novo.",
  };
}

const emptyPreview = {
  total: 0,
  ready: 0,
  duplicates: 0,
  errors: 0,
  issues: [],
  warnings: [],
  sample: [],
};

/** Passo 1: lê o arquivo e mostra o que VAI acontecer. Não grava nada. */
export async function previewImport<TInput>(
  cfg: ImportConfig<TInput>,
  formData: FormData,
): Promise<ImportPreview> {
  try {
    const { entries, unknownHeaders } = await analyze(cfg, formData);
    const issues: ImportIssue[] = entries
      .filter((e) => e.status === "error")
      .map((e) => ({ row: e.row, label: e.label, message: e.message! }));
    const ready = entries.filter((e) => e.status === "ready");
    return {
      ok: true,
      total: entries.length,
      ready: ready.length,
      duplicates: entries.filter((e) => e.status === "duplicate").length,
      errors: issues.length,
      issues: issues.slice(0, MAX_ISSUES),
      warnings: [
        ...(unknownHeaders.length
          ? [`Colunas não reconhecidas (ignoradas): ${unknownHeaders.join(", ")}.`]
          : []),
        ...(issues.length > MAX_ISSUES
          ? [`Mostrando só os primeiros ${MAX_ISSUES} problemas.`]
          : []),
      ],
      sample: ready.slice(0, 5).map((e) => ({ row: e.row, label: e.label })),
    };
  } catch (e) {
    return { ...emptyPreview, ...failure(e) };
  }
}

/** Passo 2: grava. Revalida tudo no servidor. Linhas com erro nunca entram. */
export async function confirmImport<TInput>(
  cfg: ImportConfig<TInput>,
  formData: FormData,
): Promise<ImportDone> {
  const mode: DuplicateMode = formData.get("mode") === "update" ? "update" : "skip";
  const base: ImportDone = { ok: true, created: 0, updated: 0, skipped: 0, failed: 0, issues: [] };

  let entries: Entry<TInput>[];
  try {
    entries = (await analyze(cfg, formData)).entries;
  } catch (e) {
    return { ...base, ...failure(e) };
  }

  const { organizationId, log, withDb } = await requireModule(cfg.module);
  const result = { ...base };

  const ready = entries.filter((e) => e.status === "ready");
  for (let i = 0; i < ready.length; i += CHUNK) {
    const batch = ready.slice(i, i + CHUNK);
    try {
      await withDb((tx) =>
        cfg.insertMany(
          tx,
          organizationId,
          batch.map((e) => e.input!),
        ),
      );
      result.created += batch.length;
    } catch {
      for (const e of batch) {
        try {
          await withDb((tx) => cfg.insertMany(tx, organizationId, [e.input!]));
          result.created++;
        } catch {
          result.failed++;
          result.issues.push({
            row: e.row,
            label: e.label,
            message: `Não foi possível gravar este ${cfg.entitySingular}.`,
          });
        }
      }
    }
  }

  const duplicates = entries.filter((e) => e.status === "duplicate");
  if (mode === "skip") {
    result.skipped = duplicates.length;
  } else {
    for (const e of duplicates) {
      try {
        const found = await withDb((tx) =>
          cfg.updateOne(tx, organizationId, e.existingId!, e.input!, e.raw),
        );
        if (!found) throw new Error("sumiu");
        result.updated++;
      } catch {
        result.failed++;
        result.issues.push({
          row: e.row,
          label: e.label,
          message: `Não foi possível atualizar este ${cfg.entitySingular}.`,
        });
      }
    }
  }

  log.info(cfg.logEvent, {
    mode,
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
    failed: result.failed,
    errors: entries.filter((e) => e.status === "error").length,
  });
  revalidatePath(cfg.revalidate);
  return result;
}

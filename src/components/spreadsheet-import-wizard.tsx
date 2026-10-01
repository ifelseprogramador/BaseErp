"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DuplicateMode, ImportDone, ImportPreview } from "@/core/spreadsheet/types";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-sm font-semibold">{title}</p>
        {children}
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "ok" | "warn" | "bad";
}) {
  const color = {
    ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    warn: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    bad: "bg-destructive/10 text-destructive",
  }[tone];
  return (
    <div className={`flex flex-1 flex-col items-center rounded-lg px-2 py-2 ${color}`}>
      <span className="text-xl font-semibold">{value}</span>
      <span className="text-center text-xs">{label}</span>
    </div>
  );
}

/**
 * Assistente de importação por planilha, igual para qualquer cadastro:
 * 1) baixar o modelo, 2) preencher, 3) enviar → prévia do que vai
 * acontecer (prontos / já existem / com problema) → confirmar. Nada é
 * gravado antes da confirmação. As Server Actions ficam em cada módulo.
 */
export function SpreadsheetImportWizard({
  entityPlural,
  templateHref,
  exportHref,
  previewAction,
  confirmAction,
  doneHref,
  doneLabel,
  duplicateHint,
}: {
  /** Ex.: "clientes". */
  entityPlural: string;
  templateHref: string;
  exportHref: string;
  previewAction: (formData: FormData) => Promise<ImportPreview>;
  confirmAction: (formData: FormData) => Promise<ImportDone>;
  doneHref: string;
  doneLabel: string;
  /** Como o sistema reconhece um registro que já existe (ex.: "mesmo CPF/CNPJ"). */
  duplicateHint: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [done, setDone] = useState<ImportDone | null>(null);
  const [mode, setMode] = useState<DuplicateMode>("skip");
  const [dragging, setDragging] = useState(false);
  const [working, startWork] = useTransition();

  function reset() {
    setFile(null);
    setPreview(null);
    setDone(null);
    setMode("skip");
    if (inputRef.current) inputRef.current.value = "";
  }

  function pick(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setPreview(null);
    setDone(null);
    const fd = new FormData();
    fd.set("file", f);
    startWork(async () => setPreview(await previewAction(fd)));
  }

  function confirm() {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("mode", mode);
    startWork(async () => setDone(await confirmAction(fd)));
  }

  const toImport = preview ? preview.ready + (mode === "update" ? preview.duplicates : 0) : 0;

  return (
    <div className="flex flex-col gap-6">
      <Step n={1} title="Baixe o modelo">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={templateHref} download />}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Modelo em branco (.xlsx)
          </Button>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<a href={exportHref} download />}
          >
            <FileSpreadsheet className="mr-1.5 h-4 w-4" />
            Ou exportar {entityPlural} atuais
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Abre no Excel, Google Planilhas e LibreOffice. Tem uma aba de instruções.
        </p>
      </Step>

      <Step n={2} title="Preencha a planilha">
        <p className="text-muted-foreground text-sm">
          Uma linha por registro. Colunas com <strong>*</strong> são obrigatórias. Onde aparecer uma
          seta, escolha da lista. Também aceitamos arquivos <strong>.csv</strong>.
        </p>
      </Step>

      <Step n={3} title="Envie o arquivo preenchido">
        {!done && (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pick(e.dataTransfer.files[0]);
            }}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${dragging ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
          >
            <Upload className="text-muted-foreground h-6 w-6" />
            <span className="text-sm font-medium">
              {file ? file.name : "Clique para escolher ou arraste o arquivo aqui"}
            </span>
            <span className="text-muted-foreground text-xs">.xlsx ou .csv, até 5 MB</span>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </label>
        )}

        {working && !done && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            {preview ? "Importando…" : "Lendo a planilha…"}
          </p>
        )}

        {preview && !preview.ok && !done && (
          <div className="border-destructive/30 bg-destructive/5 flex items-start gap-2 rounded-lg border p-3 text-sm">
            <XCircle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
            <span>{preview.message}</span>
          </div>
        )}

        {preview?.ok && !done && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Stat value={preview.ready} label="prontos para importar" tone="ok" />
              <Stat value={preview.duplicates} label="já existem" tone="warn" />
              <Stat value={preview.errors} label="com problema" tone="bad" />
            </div>

            {preview.warnings.map((w) => (
              <p key={w} className="text-muted-foreground flex items-start gap-2 text-xs">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {w}
              </p>
            ))}

            {preview.issues.length > 0 && (
              <div className="rounded-lg border">
                <p className="border-b px-3 py-2 text-sm font-medium">
                  O que precisa ser corrigido (essas linhas não serão importadas)
                </p>
                <ul className="max-h-48 divide-y overflow-y-auto text-sm">
                  {preview.issues.map((i, k) => (
                    <li key={k} className="flex flex-col gap-0.5 px-3 py-1.5">
                      <span className="font-medium">
                        Linha {i.row}
                        {i.label ? ` — ${i.label}` : ""}
                      </span>
                      <span className="text-destructive text-xs">{i.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.sample.length > 0 && (
              <p className="text-muted-foreground text-xs">
                Exemplos prontos: {preview.sample.map((s) => s.label).join(", ")}
                {preview.ready > preview.sample.length ? "…" : ""}
              </p>
            )}

            {preview.duplicates > 0 && (
              <fieldset className="flex flex-col gap-1.5 rounded-lg border p-3 text-sm">
                <legend className="px-1 text-xs font-medium">
                  Os {preview.duplicates} que já existem ({duplicateHint}):
                </legend>
                {(
                  [
                    ["skip", "Pular — manter como está no sistema"],
                    [
                      "update",
                      "Atualizar com os dados da planilha (célula em branco não apaga nada)",
                    ],
                  ] as const
                ).map(([v, l]) => (
                  <label key={v} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === v}
                      onChange={() => setMode(v)}
                    />
                    {l}
                  </label>
                ))}
              </fieldset>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={confirm} disabled={working || toImport === 0}>
                {working ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                {toImport === 0 ? "Nada para importar" : `Importar ${toImport} ${entityPlural}`}
              </Button>
              <Button variant="ghost" onClick={reset} disabled={working}>
                Escolher outro arquivo
              </Button>
            </div>
          </div>
        )}

        {done && (
          <div className="flex flex-col gap-3 rounded-xl border p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              {done.ok ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <XCircle className="text-destructive h-5 w-5" />
              )}
              {done.ok ? "Importação concluída" : (done.message ?? "Não foi possível importar.")}
            </p>
            {done.ok && (
              <ul className="text-sm">
                <li>{done.created} novos</li>
                {done.updated > 0 && <li>{done.updated} atualizados</li>}
                {done.skipped > 0 && <li>{done.skipped} pulados (já existiam)</li>}
                {done.failed > 0 && (
                  <li className="text-destructive">{done.failed} com falha ao gravar</li>
                )}
              </ul>
            )}
            {done.issues.length > 0 && (
              <ul className="text-destructive max-h-32 overflow-y-auto text-xs">
                {done.issues.map((i, k) => (
                  <li key={k}>
                    Linha {i.row}: {i.message}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Button nativeButton={false} render={<Link href={doneHref} />}>
                {doneLabel}
              </Button>
              <Button variant="ghost" onClick={reset}>
                Importar outro arquivo
              </Button>
            </div>
          </div>
        )}
      </Step>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Minus, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCents, multiplyCents, parseReaisInput } from "@/core/money";

/** Uma opção encontrada pela busca (cliente, veículo, peça…). */
export interface FacilOption {
  value: string;
  label: string;
  subtitle?: string;
  /** Preço padrão, em centavos (itens de catálogo). */
  priceCents?: number;
  /** Dados extras que o item carrega (ex.: tipo, unidade, tamanhos aceitos). */
  extras?: Record<string, string>;
}

export interface MiniField {
  key: string;
  label: string;
  type?: "text" | "tel" | "email" | "money" | "number";
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  /** Com `choices`, o campo vira botões grandes (ex.: Peça ou Serviço). */
  choices?: { value: string; label: string }[];
  /** Com `choices`: tocar de novo na opção escolhida desmarca (campo opcional). */
  clearable?: boolean;
  /** Opcional "de verdade": só aparece depois de "Mais dados (opcional)". */
  advanced?: boolean;
}

export interface MiniResult {
  ok: boolean;
  option?: FacilOption;
  errors?: Record<string, string[]>;
  message?: string;
}

/** Mini-formulário de "cadastrar na hora": abre dentro da própria etapa. */
export interface MiniCreate {
  id: string;
  /** Texto do botão, ex.: "Cadastrar novo cliente". */
  label: string;
  title: string;
  fields: MiniField[];
  submitLabel?: string;
  submit: (values: Record<string, string>) => Promise<MiniResult>;
}

const SEARCH_DELAY_MS = 250;

/**
 * Mini-formulário embutido. Os campos NÃO têm `name` (ficam fora do
 * `FormData` do assistente) e levam `data-facil-ignore`, para o assistente
 * não os conferir nem tratar o Enter deles como "avançar". O Enter aqui salva.
 */
function MiniForm({
  spec,
  onDone,
  onCancel,
}: {
  spec: MiniCreate;
  onDone: (option: FacilOption) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(spec.fields.map((field) => [field.key, field.defaultValue ?? ""])),
  );
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<MiniResult | null>(null);
  const [showMore, setShowMore] = useState(false);

  const advancedFields = spec.fields.filter((field) => field.advanced);
  // Se o servidor recusou um campo opcional, abre a seção para a pessoa ver onde.
  const moreOpen =
    showMore || advancedFields.some((field) => (result?.errors?.[field.key]?.length ?? 0) > 0);
  const visibleFields = spec.fields.filter((field) => !field.advanced || moreOpen);

  // Erros de campos que este mini-formulário NÃO mostra (ex.: a validação do
  // servidor recusou um campo opcional que não está na tela). Nunca engolir:
  // a pessoa precisa ver por que não salvou.
  const shown = new Set(visibleFields.map((field) => field.key));
  const hiddenErrors = Object.entries(result?.errors ?? {})
    .filter(([key]) => !shown.has(key))
    .flatMap(([, messages]) => messages);

  async function save() {
    const missing = spec.fields.find((field) => field.required && !values[field.key]?.trim());
    if (missing) {
      setResult({ ok: false, errors: { [missing.key]: [`Preencha: ${missing.label}.`] } });
      return;
    }
    setPending(true);
    try {
      const outcome = await spec.submit(values);
      if (outcome.ok && outcome.option) onDone(outcome.option);
      else setResult(outcome);
    } catch {
      setResult({ ok: false, message: "Não foi possível salvar. Tente de novo." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      data-facil-ignore
      className="border-primary/30 bg-card motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 flex flex-col gap-4 rounded-2xl border-2 p-4 text-left"
    >
      <p className="text-lg font-semibold">{spec.title}</p>
      {visibleFields.map((field) => {
        const errors = result?.errors?.[field.key];
        return (
          <div key={field.key} className="flex flex-col gap-2">
            <Label className="text-base">
              {field.label}
              {field.required && <span className="text-destructive"> *</span>}
            </Label>
            {field.choices ? (
              <div className="flex flex-wrap gap-2">
                {field.choices.map((choice) => (
                  <button
                    key={choice.value}
                    type="button"
                    aria-pressed={values[field.key] === choice.value}
                    onClick={() =>
                      setValues((v) => ({
                        ...v,
                        [field.key]:
                          field.clearable && v[field.key] === choice.value ? "" : choice.value,
                      }))
                    }
                    className={cn(
                      "h-12 rounded-full border-2 px-5 text-base font-semibold transition-colors",
                      values[field.key] === choice.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            ) : (
              <Input
                aria-label={field.label}
                type={field.type === "money" ? "text" : (field.type ?? "text")}
                inputMode={
                  field.type === "money"
                    ? "decimal"
                    : field.type === "number"
                      ? "numeric"
                      : undefined
                }
                placeholder={field.placeholder}
                autoComplete="off"
                value={values[field.key] ?? ""}
                onChange={(event) => setValues((v) => ({ ...v, [field.key]: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  event.stopPropagation();
                  void save();
                }}
                className="h-12 rounded-xl px-4 text-lg md:text-lg"
              />
            )}
            {errors?.map((message) => (
              <p key={message} role="alert" className="text-destructive text-sm">
                {message}
              </p>
            ))}
          </div>
        );
      })}
      {advancedFields.length > 0 && !moreOpen && (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="text-primary flex h-11 items-center gap-2 self-start text-base font-semibold hover:underline"
        >
          <Plus className="h-5 w-5" />
          Mais dados (opcional)
        </button>
      )}
      {[...(result?.message ? [result.message] : []), ...hiddenErrors].map((message) => (
        <p key={message} role="alert" className="text-destructive text-sm">
          {message}
        </p>
      ))}
      {result && !result.ok && !result.message && hiddenErrors.length === 0 && !result.errors && (
        <p role="alert" className="text-destructive text-sm">
          Não foi possível salvar. Confira os dados e tente de novo.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-full px-5 text-base"
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          className="h-12 gap-2 rounded-full px-5 text-base font-semibold"
          disabled={pending}
          onClick={() => void save()}
        >
          {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
          {spec.submitLabel ?? "Salvar e usar"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Busca no SERVIDOR + "cadastrar na hora". Sem texto mostra o que a própria
 * `search("")` devolver (os mais recentes); ao digitar, espera um instante e
 * consulta de novo, ignorando respostas atrasadas — por isso aguenta
 * milhares de registros. Cada `creates` vira um botão "＋ Cadastrar novo…" que
 * abre o mini-formulário ali mesmo; ao salvar, o novo registro já é escolhido.
 */
function SearchPanel({
  search,
  creates = [],
  onPick,
  placeholder,
  emptyText,
  autoFocus = false,
}: {
  search: (term: string) => Promise<FacilOption[]>;
  creates?: MiniCreate[];
  onPick: (option: FacilOption) => void;
  placeholder: string;
  emptyText: string;
  autoFocus?: boolean;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<FacilOption[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [openCreate, setOpenCreate] = useState<string | null>(null);
  const searchRef = useRef(search);
  const requestRef = useRef(0);

  useEffect(() => {
    searchRef.current = search;
  });

  useEffect(() => {
    const request = ++requestRef.current;
    const timer = setTimeout(
      async () => {
        setLoading(true);
        try {
          const found = await searchRef.current(term.trim());
          if (request !== requestRef.current) return;
          setResults(found);
          setFailed(false);
        } catch {
          if (request === requestRef.current) setFailed(true);
        } finally {
          if (request === requestRef.current) setLoading(false);
        }
      },
      term ? SEARCH_DELAY_MS : 0,
    );
    return () => clearTimeout(timer);
  }, [term]);

  const spec = creates.find((create) => create.id === openCreate);
  if (spec) {
    return <MiniForm spec={spec} onDone={onPick} onCancel={() => setOpenCreate(null)} />;
  }

  return (
    <div className="flex flex-col gap-3" data-facil-ignore>
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-4 h-6 w-6 -translate-y-1/2" />
        <Input
          type="search"
          aria-label="Procurar"
          placeholder={placeholder}
          autoComplete="off"
          autoFocus={autoFocus}
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            // Enter aqui não avança a etapa: com um único resultado, escolhe-o.
            event.preventDefault();
            event.stopPropagation();
            if (results?.length === 1) onPick(results[0]);
          }}
          className="h-14 rounded-full pr-12 pl-12 text-lg md:text-lg"
        />
        {loading && (
          <Loader2 className="text-muted-foreground absolute top-1/2 right-4 h-6 w-6 -translate-y-1/2 animate-spin" />
        )}
      </div>

      {failed && (
        <p role="alert" className="text-destructive text-center text-sm">
          Não consegui buscar agora. Confira a internet e tente de novo.
        </p>
      )}

      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1" role="listbox">
        {results?.map((option) => (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={false}
            onClick={() => onPick(option)}
            className="bg-card flex min-h-16 flex-col justify-center rounded-2xl border-2 border-transparent px-4 py-2 text-left shadow-xs ring-1 ring-black/5 transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] motion-reduce:transition-none dark:ring-white/10"
          >
            <span className="text-lg font-semibold">{option.label}</span>
            {option.subtitle && (
              <span className="text-muted-foreground text-sm">{option.subtitle}</span>
            )}
          </button>
        ))}
        {results && results.length === 0 && !loading && (
          <p className="text-muted-foreground rounded-2xl border-2 border-dashed p-5 text-center">
            {term ? `Nada encontrado para “${term}”.` : emptyText}
          </p>
        )}
      </div>

      {creates.map((create) => (
        <button
          key={create.id}
          type="button"
          onClick={() => setOpenCreate(create.id)}
          className="border-primary/40 text-primary hover:bg-primary/5 flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 text-lg font-semibold transition-colors active:scale-[0.98]"
        >
          <Plus className="h-6 w-6" />
          {create.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Escolha de UM registro com busca no servidor e cadastro na hora. Guarda o
 * escolhido num campo `required` com o `name` pedido (o `FormData` do assistente
 * leva o valor e a conferência da etapa funciona). Trocar de escolha volta à busca.
 */
export function FacilSearchField({
  name,
  required = false,
  search,
  creates,
  onChange,
  placeholder = "Digite para procurar",
  emptyText = "Nada cadastrado ainda.",
  autoFocus = false,
  defaultOption,
}: {
  name: string;
  required?: boolean;
  search: (term: string) => Promise<FacilOption[]>;
  creates?: MiniCreate[];
  onChange?: (option: FacilOption | null) => void;
  placeholder?: string;
  emptyText?: string;
  autoFocus?: boolean;
  /** Já vem escolhido (ex.: chegou da ficha do cliente); "Trocar" volta à busca. */
  defaultOption?: FacilOption;
}) {
  const [selected, setSelected] = useState<FacilOption | null>(defaultOption ?? null);

  function choose(option: FacilOption | null) {
    setSelected(option);
    onChange?.(option);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Não é `readOnly`/`hidden`: esses ficam fora da validação do navegador. */}
      <input
        name={name}
        required={required}
        value={selected?.value ?? ""}
        onChange={() => {}}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
      {selected ? (
        <div className="border-primary bg-primary/10 motion-safe:animate-in motion-safe:zoom-in-95 flex min-h-16 items-center gap-3 rounded-2xl border-2 px-4 py-2">
          <Check className="text-primary h-7 w-7 shrink-0" />
          <span className="flex min-w-0 flex-1 flex-col text-left">
            <span className="truncate text-lg font-semibold">{selected.label}</span>
            {selected.subtitle && (
              <span className="text-muted-foreground truncate text-sm">{selected.subtitle}</span>
            )}
          </span>
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 rounded-full px-4 text-base"
            onClick={() => choose(null)}
          >
            Trocar
          </Button>
        </div>
      ) : (
        <SearchPanel
          search={search}
          creates={creates}
          onPick={choose}
          placeholder={placeholder}
          emptyText={emptyText}
          autoFocus={autoFocus}
        />
      )}
    </div>
  );
}

export interface FacilLine {
  key: number;
  /** Id do item de catálogo, quando veio de lá; vazio no item avulso. */
  ref?: string;
  label: string;
  quantity: string;
  /** Preço unitário em reais, como a pessoa digita ("35,00"). */
  price: string;
  extras: Record<string, string>;
}

export interface LineField {
  key: string;
  label: string;
  /** Chave de `extras` com sugestões separadas por vírgula (ex.: tamanhos aceitos). */
  suggestionsKey?: string;
}

function reais(cents: number | undefined): string {
  return cents === undefined ? "" : (cents / 100).toFixed(2).replace(".", ",");
}

function lineTotalCents(line: FacilLine): number {
  const quantity = Number(line.quantity.replace(",", "."));
  const unit = parseReaisInput(line.price) ?? 0;
  return Number.isFinite(quantity) && quantity > 0 ? multiplyCents(unit, quantity) : 0;
}

/** Formato padrão do campo enviado: um JSON com o que o servidor precisa. */
export function serializeLines(lines: FacilLine[]): string {
  return JSON.stringify(
    lines.map((line) => ({
      ...line.extras,
      ref: line.ref,
      label: line.label,
      quantity: Number(line.quantity.replace(",", ".")) || 0,
      unitPriceCents: parseReaisInput(line.price) ?? 0,
    })),
  );
}

/** Texto da conferência para o JSON de `serializeLines`: uma linha por item
 * ("2× Óleo — R$ 70,00") e o total. Vazio se não há itens. */
export function describeLines(json: string): string {
  try {
    const rows = JSON.parse(json) as { label: string; quantity: number; unitPriceCents: number }[];
    if (!Array.isArray(rows) || rows.length === 0) return "";
    const lines = rows.map(
      (row) =>
        `${row.quantity}× ${row.label} — ${formatCents(multiplyCents(row.unitPriceCents, row.quantity))}`,
    );
    const total = rows.reduce(
      (sum, row) => sum + multiplyCents(row.unitPriceCents, row.quantity),
      0,
    );
    return [...lines, `Total: ${formatCents(total)}`].join("\n");
  } catch {
    return "";
  }
}

/**
 * Lista de itens de um orçamento/pedido: busca no catálogo (servidor), cadastro
 * de item novo e item avulso na hora, quantidade com +/−, preço editável e
 * total. Envia tudo num único campo (`name`) em JSON, para o assistente criar o
 * documento e os itens de uma vez.
 */
export function FacilItemsField({
  name,
  search,
  creates,
  lineFields = [],
  placeholder = "Procurar peça ou serviço",
  emptyText = "O catálogo ainda está vazio.",
}: {
  name: string;
  search: (term: string) => Promise<FacilOption[]>;
  creates?: MiniCreate[];
  lineFields?: LineField[];
  placeholder?: string;
  emptyText?: string;
}) {
  const [lines, setLines] = useState<FacilLine[]>([]);
  const [adding, setAdding] = useState(false);
  const nextKey = useRef(1);

  function addLine(option: FacilOption) {
    const free = option.value.startsWith("free:");
    setLines((current) => [
      ...current,
      {
        key: nextKey.current++,
        ref: free ? undefined : option.value,
        label: option.label,
        quantity: "1",
        price: reais(option.priceCents),
        extras: { ...option.extras },
      },
    ]);
    setAdding(false);
  }

  function patch(key: number, change: Partial<FacilLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...change } : line)),
    );
  }

  function step(line: FacilLine, delta: number) {
    const current = Number(line.quantity.replace(",", ".")) || 0;
    patch(line.key, { quantity: String(Math.max(1, Math.round(current + delta))) });
  }

  const total = lines.reduce((sum, line) => sum + lineTotalCents(line), 0);

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name={name} value={serializeLines(lines)} />

      {lines.map((line) => (
        <div
          key={line.key}
          data-facil-ignore
          className="bg-card motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 flex flex-col gap-3 rounded-2xl p-4 text-left ring-1 ring-black/5 dark:ring-white/10"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-lg font-semibold">{line.label}</p>
            <button
              type="button"
              aria-label={`Tirar ${line.label}`}
              onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}
              className="text-muted-foreground hover:text-destructive rounded-full p-2 transition-colors"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>

          {lineFields.map((field) => {
            const suggestions = field.suggestionsKey
              ? (line.extras[field.suggestionsKey] ?? "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [];
            return (
              <div key={field.key} className="flex flex-col gap-2">
                <Label className="text-sm">{field.label}</Label>
                {suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        aria-pressed={line.extras[field.key] === suggestion}
                        onClick={() =>
                          patch(line.key, { extras: { ...line.extras, [field.key]: suggestion } })
                        }
                        className={cn(
                          "h-10 rounded-full border-2 px-4 text-sm font-semibold transition-colors",
                          line.extras[field.key] === suggestion
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-muted",
                        )}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
                <Input
                  aria-label={field.label}
                  value={line.extras[field.key] ?? ""}
                  onChange={(event) =>
                    patch(line.key, { extras: { ...line.extras, [field.key]: event.target.value } })
                  }
                  className="h-11 rounded-xl px-3 text-base md:text-base"
                />
              </div>
            );
          })}

          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <Label className="text-sm">Quantidade</Label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Menos um"
                  onClick={() => step(line, -1)}
                  className="bg-muted hover:bg-muted/70 flex h-11 w-11 items-center justify-center rounded-full active:scale-90"
                >
                  <Minus className="h-5 w-5" />
                </button>
                <Input
                  aria-label={`Quantidade de ${line.label}`}
                  inputMode="decimal"
                  value={line.quantity}
                  onChange={(event) => patch(line.key, { quantity: event.target.value })}
                  className="h-11 w-16 rounded-xl text-center text-lg md:text-lg"
                />
                <button
                  type="button"
                  aria-label="Mais um"
                  onClick={() => step(line, 1)}
                  className="bg-muted hover:bg-muted/70 flex h-11 w-11 items-center justify-center rounded-full active:scale-90"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-sm">Preço de cada (R$)</Label>
              <Input
                aria-label={`Preço de ${line.label}`}
                inputMode="decimal"
                placeholder="0,00"
                value={line.price}
                onChange={(event) => patch(line.key, { price: event.target.value })}
                className="h-11 w-32 rounded-xl text-lg md:text-lg"
              />
            </div>
            <p className="ml-auto text-lg font-bold">{formatCents(lineTotalCents(line))}</p>
          </div>
        </div>
      ))}

      {lines.length === 0 && !adding && (
        <p className="text-muted-foreground rounded-2xl border-2 border-dashed p-5 text-center">
          Nenhum item ainda. Toque em “Adicionar item”.
        </p>
      )}

      {adding ? (
        <div className="flex flex-col gap-3">
          <SearchPanel
            search={search}
            creates={creates}
            onPick={addLine}
            placeholder={placeholder}
            emptyText={emptyText}
            autoFocus
          />
          <Button
            type="button"
            variant="ghost"
            className="h-11 gap-2 self-center rounded-full px-5 text-base"
            onClick={() => setAdding(false)}
          >
            <X className="h-5 w-5" />
            Fechar
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-14 gap-2 rounded-full text-base font-semibold"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-5 w-5" />
          Adicionar item
        </Button>
      )}

      {lines.length > 0 && (
        <div className="flex items-center justify-between rounded-2xl bg-emerald-100 px-5 py-3 text-lg font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          <span>Total</span>
          <span>{formatCents(total)}</span>
        </div>
      )}
    </div>
  );
}

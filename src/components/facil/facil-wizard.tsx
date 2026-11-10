"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardCheck,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/core/action-result";

export interface WizardStep {
  id: string;
  /** A pergunta da etapa, ex.: "Qual o nome do cliente?". */
  title: string;
  hint?: string;
  icon: LucideIcon;
  /** `name` dos campos desta etapa — usado para levar a pessoa até a etapa
   * certa quando o servidor recusa um campo. */
  fields: string[];
  content: React.ReactNode;
}

export interface WizardReviewField {
  name: string;
  label: string;
  format?: (value: string) => string;
}

type Summary = { label: string; value: string }[];

const BIG_BUTTON = "h-14 gap-2 rounded-full px-6 text-base font-semibold";

/**
 * Assistente do modo Fácil: uma pergunta por tela, com cards grandes e
 * barra de progresso em ícones, terminando numa tela "Revisar e salvar".
 *
 * Regras que NÃO podem mudar (o resto do sistema depende delas):
 *  - Todas as etapas ficam montadas no DOM (as outras só `hidden`) e usam os
 *    MESMOS `name` do formulário formal: o envio monta um único `FormData` e
 *    chama a MESMA Server Action — sem validação nem action duplicada — e o
 *    `UnsavedChangesGuard` (que compara o `FormData`) segue funcionando.
 *  - O envio é manual (`formAction` dentro de uma transition), não pelo
 *    `<form action>`: o React 19 zera os campos de um `<form action>` depois
 *    de qualquer retorno, e erro de validação nunca pode apagar o que a
 *    pessoa já preencheu corretamente.
 *  - `action` pode ser a versão embrulhada pelo hook de criação offline.
 */
export function FacilWizard({
  action,
  steps,
  review = [],
  submitLabel = "Salvar",
  cancelHref,
  onSuccess,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  steps: WizardStep[];
  review?: WizardReviewField[];
  submitLabel?: string;
  cancelHref: string;
  /** Para ações que NÃO redirecionam sozinhas (devolvem `{ ok: true, id }`): a
   * tela decide para onde ir. Quem redireciona no servidor não precisa. */
  onSuccess?: (result: ActionResult) => void;
}) {
  const [state, formAction, pending] = useActionState(action, { ok: false } as ActionResult);
  const [, startTransition] = useTransition();
  const [current, setCurrent] = useState(0);
  const [summary, setSummary] = useState<Summary>([]);
  const [seenState, setSeenState] = useState(state);
  const formRef = useRef<HTMLFormElement>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);

  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });
  useEffect(() => {
    if (state.ok) onSuccessRef.current?.(state);
  }, [state]);

  const reviewIndex = steps.length;
  const isReview = current === reviewIndex;

  // Erro do servidor: leva até a primeira etapa com campo recusado (ou para a
  // revisão, se o erro não é de nenhum campo de etapa). Estado derivado na
  // renderização, não efeito: é o padrão do React para reagir a uma nova prop.
  if (state !== seenState) {
    setSeenState(state);
    if (!state.ok && state.errors) {
      const bad = Object.keys(state.errors);
      const index = steps.findIndex((step) => step.fields.some((name) => bad.includes(name)));
      setCurrent(index >= 0 ? index : reviewIndex);
    }
  }

  function inputsOf(index: number) {
    // Campos de mini-formulários embutidos (`data-facil-ignore`) são de outra
    // ação ("cadastrar na hora") e não fazem parte desta etapa.
    return Array.from(
      panelRefs.current[index]?.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("input, select, textarea") ?? [],
    ).filter((input) => !input.closest("[data-facil-ignore]"));
  }

  /** `required`, `pattern`, `maxlength`… da etapa. O formulário é `noValidate`
   * (campos de etapas escondidas travariam o envio nativo), então a conferência
   * é feita aqui, etapa por etapa. */
  function stepIsValid(index: number): boolean {
    for (const input of inputsOf(index)) {
      if (!input.checkValidity()) {
        setCurrent(index);
        // Só dá para focar/mostrar o balão depois que a etapa aparece.
        requestAnimationFrame(() => input.reportValidity());
        return false;
      }
    }
    return true;
  }

  function readSummary(): Summary {
    const form = formRef.current;
    if (!form) return [];
    const data = new FormData(form);
    return review
      .map(({ name, label, format }) => {
        const raw = data.get(name);
        const value = typeof raw === "string" ? raw.trim() : "";
        return { label, value: value && format ? format(value) : value };
      })
      .filter((row) => row.value !== "");
  }

  function next() {
    if (!stepIsValid(current)) return;
    if (current + 1 === reviewIndex) setSummary(readSummary());
    setCurrent((c) => Math.min(c + 1, reviewIndex));
  }

  function submit() {
    const form = formRef.current;
    if (!form) return;
    for (let i = 0; i < steps.length; i++) {
      if (!stepIsValid(i)) return;
    }
    const data = new FormData(form);
    startTransition(() => formAction(data));
  }

  const fieldErrors = (names: string[]) =>
    names.flatMap((name) => state.errors?.[name] ?? []).filter(Boolean);
  const allStepFields = steps.flatMap((step) => step.fields);
  const orphanErrors = Object.entries(state.errors ?? {})
    .filter(([name]) => !allStepFields.includes(name))
    .flatMap(([, messages]) => messages);

  return (
    <form
      ref={formRef}
      noValidate
      data-unsaved-guard=""
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      onKeyDown={(event) => {
        // Enter num campo avança a etapa em vez de enviar o formulário inteiro.
        const target = event.target as HTMLElement;
        if (event.key !== "Enter" || target.tagName === "TEXTAREA" || target.tagName === "BUTTON") {
          return;
        }
        event.preventDefault();
        // Campos de buscas e de listas de itens têm o próprio Enter; aqui só
        // garantimos que ele nunca avance a etapa nem envie o formulário.
        if (target.closest("[data-facil-ignore]")) return;
        if (isReview) submit();
        else next();
      }}
      className="flex flex-col gap-6"
    >
      <ol className="flex items-center justify-center gap-2" aria-label="Etapas">
        {[...steps, { id: "revisar", title: "Revisar", icon: ClipboardCheck }].map(
          (step, index) => {
            const Icon = step.icon;
            const done = index < current;
            return (
              <li key={step.id} className="flex items-center gap-2">
                <span
                  aria-current={index === current ? "step" : undefined}
                  title={step.title}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all motion-reduce:transition-none",
                    index === current &&
                      "border-primary bg-primary text-primary-foreground scale-110 motion-safe:animate-pulse",
                    done && "border-emerald-500 bg-emerald-500 text-white",
                    index > current && "border-border text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </span>
                {index < steps.length && (
                  <span
                    className={cn(
                      "h-0.5 w-6 rounded sm:w-10",
                      done ? "bg-emerald-500" : "bg-border",
                    )}
                  />
                )}
              </li>
            );
          },
        )}
      </ol>
      <p className="text-muted-foreground text-center text-sm">
        Passo {current + 1} de {steps.length + 1}
      </p>

      {state.message && !state.ok && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-2xl p-4 text-center">
          {state.message}
        </p>
      )}

      {steps.map((step, index) => {
        const errors = fieldErrors(step.fields);
        const Icon = step.icon;
        return (
          <div
            key={step.id}
            ref={(el) => {
              panelRefs.current[index] = el;
            }}
            hidden={index !== current}
            className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-6 flex flex-col items-center gap-5 text-center motion-safe:duration-300"
          >
            <span className="bg-primary/10 text-primary rounded-full p-5">
              <Icon className="h-10 w-10" />
            </span>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{step.title}</h2>
              {step.hint && <p className="text-muted-foreground mt-1">{step.hint}</p>}
            </div>
            <div className="w-full max-w-xl text-left">{step.content}</div>
            {errors.length > 0 && (
              <ul role="alert" className="text-destructive text-sm">
                {errors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      {isReview && (
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-6 flex flex-col items-center gap-5 text-center motion-safe:duration-300">
          <span className="rounded-full bg-emerald-100 p-5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <ClipboardCheck className="h-10 w-10" />
          </span>
          <h2 className="text-2xl font-semibold tracking-tight">Está tudo certo?</h2>
          {summary.length > 0 && (
            <dl className="bg-card w-full max-w-xl divide-y rounded-2xl text-left ring-1 ring-black/5 dark:ring-white/10">
              {summary.map((row) => (
                <div key={row.label} className="flex justify-between gap-4 p-3">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="font-medium whitespace-pre-line">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {orphanErrors.length > 0 && (
            <ul role="alert" className="text-destructive text-sm">
              {orphanErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        {current === 0 ? (
          <Link
            href={cancelHref}
            className={cn(
              BIG_BUTTON,
              "text-muted-foreground hover:bg-muted inline-flex items-center",
            )}
          >
            <ArrowLeft className="h-5 w-5" />
            Cancelar
          </Link>
        ) : (
          <Button
            type="button"
            variant="outline"
            className={BIG_BUTTON}
            onClick={() => setCurrent((c) => Math.max(c - 1, 0))}
          >
            <ArrowLeft className="h-5 w-5" />
            Voltar
          </Button>
        )}

        {isReview ? (
          // `key` próprio + `type="button"`: este botão ocupa o mesmo lugar do
          // "Avançar". Sem isso o React reaproveita o mesmo elemento e, no clique
          // que abre a revisão, ele vira `submit` ANTES de o navegador decidir o
          // que fazer com o clique — e o formulário era enviado sem a pessoa
          // confirmar. O envio só acontece pelo `onClick` (ou pelo Enter na revisão).
          <Button
            key="salvar"
            type="button"
            onClick={submit}
            className={cn(BIG_BUTTON, "bg-emerald-600 hover:bg-emerald-700")}
            disabled={pending}
          >
            {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
            {pending ? "Salvando…" : submitLabel}
          </Button>
        ) : (
          <Button key="avancar" type="button" className={BIG_BUTTON} onClick={next}>
            Avançar
            <ArrowRight className="h-5 w-5" />
          </Button>
        )}
      </div>
    </form>
  );
}

/** Rótulo + campo grande de uma etapa. */
export function FacilField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor} className="text-base">
        {label}
      </Label>
      {children}
      {hint && <p className="text-muted-foreground text-sm">{hint}</p>}
    </div>
  );
}

/** Classe dos campos de texto grandes do modo Fácil (sobrescreve `Input`). */
export const FACIL_INPUT_CLASS = "h-14 rounded-xl px-4 text-lg md:text-lg";

/**
 * Escolha por cards (ex.: "Pessoa ou Empresa?"). São `<input type="radio">`
 * de verdade, só escondidos: teclado, leitor de tela e `FormData` funcionam
 * como num formulário comum.
 */
export function FacilChoiceField({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: { value: string; label: string; hint?: string; icon: LucideIcon }[];
  defaultValue?: string;
}) {
  return (
    <div
      role="radiogroup"
      className={cn("grid gap-3", options.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2")}
    >
      {options.map(({ value, label, hint, icon: Icon }) => (
        <label key={value} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={value}
            defaultChecked={defaultValue === value}
            className="peer sr-only"
          />
          <span className="bg-card peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:ring-ring flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-transparent p-4 text-center shadow-xs ring-1 ring-black/5 transition-all peer-focus-visible:ring-2 hover:-translate-y-0.5 hover:shadow-md active:scale-95 motion-reduce:transition-none dark:ring-white/10">
            <Icon className="text-primary h-9 w-9" />
            <span className="text-lg font-semibold">{label}</span>
            {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

/**
 * Escolha de UM item de uma lista longa (cliente, veículo…), em cards com
 * busca. São `<input type="radio">` de verdade: os não encontrados pela busca
 * só ficam escondidos (continuam no DOM), então a escolha já feita não se
 * perde ao filtrar e o `FormData` leva o valor certo. `required` vale para o
 * grupo todo.
 */
export function FacilPickField({
  name,
  options,
  defaultValue,
  required = false,
  onChange,
  searchPlaceholder = "Digite para procurar",
  emptyText = "Nada para escolher ainda.",
}: {
  name: string;
  options: { value: string; label: string; subtitle?: string }[];
  defaultValue?: string;
  required?: boolean;
  onChange?: (value: string) => void;
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  const [filter, setFilter] = useState("");
  const term = filter.trim().toLowerCase();

  if (options.length === 0) {
    return (
      <p className="text-muted-foreground rounded-2xl border-2 border-dashed p-6 text-center">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {options.length > 6 && (
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Procurar"
          className="border-input bg-background h-12 w-full rounded-full border px-5 text-base"
        />
      )}
      <div role="radiogroup" className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
        {options.map((option) => {
          const visible =
            !term ||
            option.label.toLowerCase().includes(term) ||
            (option.subtitle?.toLowerCase().includes(term) ?? false);
          return (
            <label key={option.value} hidden={!visible} className="cursor-pointer">
              <input
                type="radio"
                name={name}
                value={option.value}
                required={required}
                defaultChecked={defaultValue === option.value}
                onChange={() => onChange?.(option.value)}
                className="peer sr-only"
              />
              <span className="bg-card peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:ring-ring flex min-h-16 flex-col justify-center rounded-2xl border-2 border-transparent px-4 py-2 shadow-xs ring-1 ring-black/5 transition-all peer-focus-visible:ring-2 hover:shadow-md active:scale-[0.98] motion-reduce:transition-none dark:ring-white/10">
                <span className="text-lg font-semibold">{option.label}</span>
                {option.subtitle && (
                  <span className="text-muted-foreground text-sm">{option.subtitle}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

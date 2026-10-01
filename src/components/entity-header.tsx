import type { ReactNode } from "react";

const CONNECTORS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "&",
  "ltda",
  "me",
  "epp",
  "eireli",
  "sa",
  "s/a",
]);

/** Iniciais para o avatar: 2 primeiras palavras "de verdade" (ignora de/da/Ltda…). */
export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w));
  const meaningful = words.filter((w) => !CONNECTORS.has(w.toLowerCase().replace(/[.,]/g, "")));
  const pick = (meaningful.length ? meaningful : words).slice(0, 2);
  const letters = pick.map((w) => [...w.replace(/^[^\p{L}\p{N}]+/u, "")][0] ?? "").join("");
  return letters.toUpperCase() || "?";
}

/**
 * Cabeçalho de "perfil" de um registro (cliente, fornecedor…): avatar com
 * iniciais, título limitado a 2 linhas (nomes de empresa longos não
 * quebram o layout; o texto completo vai no `title` e no formulário),
 * subtítulo e selos. `back` e `actions` ficam na linha de cima.
 */
export function EntityHeader({
  title,
  subtitle,
  badges,
  back,
  actions,
}: {
  title: string;
  subtitle?: string | null;
  badges?: ReactNode;
  back?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="from-primary/10 via-background to-background flex flex-col gap-4 rounded-2xl border bg-gradient-to-br p-4 sm:p-5 print:hidden">
      {(back || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="shrink-0">{back}</div>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </div>
      )}
      <div className="flex items-start gap-4">
        <div
          aria-hidden="true"
          className="bg-primary text-primary-foreground flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold tracking-wide shadow-sm"
        >
          {initialsOf(title)}
        </div>
        <div className="min-w-0 flex-1">
          <h1
            title={title}
            className="line-clamp-2 text-xl leading-tight font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-2xl"
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-muted-foreground mt-0.5 line-clamp-1 text-sm [overflow-wrap:anywhere]">
              {subtitle}
            </p>
          )}
          {badges && <div className="mt-2.5 flex flex-wrap items-center gap-1.5">{badges}</div>}
        </div>
      </div>
    </header>
  );
}

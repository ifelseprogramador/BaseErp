/**
 * Filtros e ordenação COMUNS a toda lista (layouts Formal e Fácil usam os
 * mesmos parâmetros de URL e as mesmas queries). Cada módulo só declara o
 * que é específico dele (status, tipo, ano…); o "Período" de cadastro é igual
 * em todos — `?periodo=hoje|7d|30d|mes|ano`.
 */

export const PERIOD_OPTIONS = [
  { value: "hoje", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "mes", label: "Este mês" },
  { value: "ano", label: "Este ano" },
] as const;

export type Period = (typeof PERIOD_OPTIONS)[number]["value"];

/** Valor da URL → período válido (qualquer outra coisa vira "sem filtro"). */
export function parsePeriod(value: unknown): Period | undefined {
  return PERIOD_OPTIONS.find((o) => o.value === value)?.value;
}

/** Primeiro instante do período (fuso do servidor), para `createdAt >= …`. */
export function periodStart(period: Period, now: Date = new Date()): Date {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case "hoje":
      return today;
    case "7d":
      return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    case "30d":
      return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
    case "mes":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "ano":
      return new Date(now.getFullYear(), 0, 1);
  }
}

/** Valor da URL → uma das chaves permitidas (ou `undefined`). */
export function pickOption<T extends string>(
  value: unknown,
  allowed: readonly T[] | Record<T, unknown>,
): T | undefined {
  const keys = (Array.isArray(allowed) ? allowed : Object.keys(allowed)) as readonly string[];
  return typeof value === "string" && keys.includes(value) ? (value as T) : undefined;
}

/** `?periodo=` da URL → data mínima de cadastro (ou `undefined`). */
export function sinceFromParam(value: unknown, now: Date = new Date()): Date | undefined {
  const period = parsePeriod(value);
  return period ? periodStart(period, now) : undefined;
}

/** Filtro "Período" pronto para qualquer `FilterField` de lista. */
export const PERIOD_FILTER = {
  param: "periodo",
  allLabel: "Qualquer data",
  options: PERIOD_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
};

/** Há busca ou filtro ativo? (a ordem não conta). Usado para mostrar a lista inteira. */
export function hasActiveFilter(options: Record<string, unknown>): boolean {
  return Object.entries(options).some(([key, value]) => key !== "sort" && Boolean(value));
}

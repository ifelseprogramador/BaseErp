"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ArrowUpDown, FilterX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FilterField, FilterOption } from "@/components/list-filter-bar";

/**
 * Filtros e ordenação da lista no modo Fácil: o MESMO que a barra da tela
 * formal (`ListFilterBar`) — mesmos parâmetros de URL (`?status=`, `?sort=`…)
 * e mesmas queries —, só que em botões grandes (um grupo por filtro) e um
 * seletor de ordem grande. Tudo vive na URL; a página relê `searchParams`.
 */
export function FacilFilters({
  filters,
  sortOptions,
  defaultSort,
}: {
  filters: FilterField[];
  sortOptions: FilterOption[];
  defaultSort: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  const active =
    filters.some((f) => searchParams.get(f.param)) ||
    (searchParams.get("sort") ?? defaultSort) !== defaultSort;

  function clearAll() {
    const params = new URLSearchParams(searchParams);
    for (const f of filters) params.delete(f.param);
    params.delete("sort");
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <div
      className={cn("flex flex-col gap-3", pending && "opacity-70 transition-opacity")}
      data-facil-filters
    >
      {filters.map((filter) => {
        const current = searchParams.get(filter.param) ?? "";
        const choices = [{ value: "", label: filter.allLabel }, ...filter.options];
        return (
          <div
            key={filter.param}
            role="group"
            aria-label={filter.allLabel}
            className="flex flex-wrap items-center gap-2"
          >
            {choices.map((choice) => {
              const selected = current === choice.value;
              return (
                <button
                  key={choice.value || "todos"}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setParam(filter.param, choice.value || null)}
                  className={cn(
                    "min-h-11 rounded-full px-4 text-sm font-medium ring-1 ring-black/10 transition-colors dark:ring-white/15",
                    selected
                      ? "bg-primary text-primary-foreground ring-transparent"
                      : "bg-card hover:bg-muted",
                  )}
                >
                  {choice.label}
                </button>
              );
            })}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-2">
        <label className="bg-card flex min-h-11 items-center gap-2 rounded-full px-4 text-sm ring-1 ring-black/10 dark:ring-white/15">
          <ArrowUpDown className="h-4 w-4 shrink-0" aria-hidden />
          <span className="text-muted-foreground">Ordenar por</span>
          <select
            aria-label="Ordenar por"
            className="bg-transparent py-2 font-medium outline-none"
            value={searchParams.get("sort") ?? defaultSort}
            onChange={(e) =>
              setParam("sort", e.target.value === defaultSort ? null : e.target.value)
            }
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {active && (
          <button
            type="button"
            onClick={clearAll}
            className="text-muted-foreground hover:bg-muted inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium"
          >
            <FilterX className="h-4 w-4" aria-hidden />
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}

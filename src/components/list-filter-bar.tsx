"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ArrowUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterField {
  /** Nome do parâmetro na URL, ex.: "status", "type", "year". */
  param: string;
  /** Texto do item "sem filtro" (também o placeholder do select). */
  allLabel: string;
  options: FilterOption[];
}

const ALL = "__all__";

/**
 * Barra de filtro + ordenação padrão pra qualquer lista de módulo — um
 * select por coluna filtrável (`filters`, ex.: status da OS, tipo do
 * catálogo, ano do veículo) mais um select de ordenação (`sortOptions`,
 * cada opção já é uma combinação coluna+direção, ex.:
 * `{value: "name-asc", label: "Nome (A→Z)"}`). Tudo vive na URL — a
 * página (Server Component) relê `searchParams` e refaz a query, mesmo
 * padrão de `search-box.tsx`. Não duplicar esta barra dentro de
 * `modules/<modulo>/` — configurar por aqui mesmo.
 */
export function ListFilterBar({
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
  const [, startTransition] = useTransition();

  function setParam(key: string, value: string, omitWhen: string) {
    const params = new URLSearchParams(searchParams);
    if (value && value !== omitWhen) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => {
        const current = searchParams.get(filter.param) ?? ALL;
        return (
          <Select
            key={filter.param}
            value={current}
            onValueChange={(value) => setParam(filter.param, String(value), ALL)}
            items={{
              [ALL]: filter.allLabel,
              ...Object.fromEntries(filter.options.map((o) => [o.value, o.label])),
            }}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{filter.allLabel}</SelectItem>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}

      <Select
        value={searchParams.get("sort") ?? defaultSort}
        onValueChange={(value) => setParam("sort", String(value), defaultSort)}
        items={Object.fromEntries(sortOptions.map((o) => [o.value, o.label]))}
      >
        <SelectTrigger className="w-[190px]">
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

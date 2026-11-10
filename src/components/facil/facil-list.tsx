import Link from "next/link";
import { ChevronRight, SearchX, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FACIL_ENTER_CLASS, facilEnterStyle, facilTone } from "@/components/facil/facil-tile";

export interface FacilListItem {
  id: string;
  /** Sem `href` o card não é link (ex.: itens de uma ordem, só para ler). */
  href?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  /** Sem ícone, o card mostra as iniciais do título. */
  icon?: LucideIcon;
}

function initials(text: string): string {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "?") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "");
  return letters.toUpperCase();
}

/**
 * Lista do modo Fácil: um card por registro (nunca tabela), com avatar,
 * título, uma linha de apoio e seta. Mostra só os primeiros `limit`; o
 * restante fica atrás de "Ver todos" (`moreHref`) para a tela não virar um
 * paredão — as listas do sistema ainda não têm paginação.
 */
export function FacilList({
  items,
  emptyTitle,
  emptyHint,
  emptyAction,
  limit = 24,
  moreHref,
}: {
  items: FacilListItem[];
  emptyTitle: string;
  emptyHint?: string;
  emptyAction?: React.ReactNode;
  limit?: number;
  moreHref?: string;
}) {
  if (items.length === 0) {
    return (
      <div
        className={cn(
          "bg-card flex flex-col items-center gap-3 rounded-2xl p-8 text-center ring-1 ring-black/5 dark:ring-white/10",
          FACIL_ENTER_CLASS,
        )}
      >
        <span className="bg-muted text-muted-foreground rounded-full p-4">
          <SearchX className="h-9 w-9" />
        </span>
        <p className="text-lg font-semibold">{emptyTitle}</p>
        {emptyHint && <p className="text-muted-foreground text-sm">{emptyHint}</p>}
        {emptyAction}
      </div>
    );
  }

  const shown = items.slice(0, limit);
  const hidden = items.length - shown.length;

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid gap-3 sm:grid-cols-2">
        {shown.map((item, index) => {
          const Icon = item.icon;
          return (
            <li key={item.id}>
              {(() => {
                const className = cn(
                  "group/item bg-card flex min-h-20 items-center gap-4 rounded-2xl p-3 shadow-xs ring-1 ring-black/5 dark:ring-white/10",
                  FACIL_ENTER_CLASS,
                  item.href &&
                    "transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] motion-reduce:transition-none",
                );
                const content = (
                  <>
                    <span
                      className={cn(
                        "flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold motion-reduce:transition-none",
                        item.href && "transition-transform group-hover/item:scale-110",
                        facilTone(index),
                      )}
                    >
                      {Icon ? <Icon className="h-7 w-7" /> : initials(item.title)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-lg font-semibold">{item.title}</span>
                      {item.subtitle && (
                        <span className="text-muted-foreground truncate text-sm">
                          {item.subtitle}
                        </span>
                      )}
                    </span>
                    {item.badge && (
                      <span className="bg-muted rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap">
                        {item.badge}
                      </span>
                    )}
                    {item.href && (
                      <ChevronRight className="text-muted-foreground h-6 w-6 shrink-0 transition-transform group-hover/item:translate-x-1 motion-reduce:transition-none" />
                    )}
                  </>
                );
                return item.href ? (
                  <Link href={item.href} style={facilEnterStyle(index)} className={className}>
                    {content}
                  </Link>
                ) : (
                  <div style={facilEnterStyle(index)} className={className}>
                    {content}
                  </div>
                );
              })()}
            </li>
          );
        })}
      </ul>
      {hidden > 0 && moreHref && (
        <Link
          href={moreHref}
          className="bg-muted hover:bg-muted/70 mx-auto inline-flex h-12 items-center rounded-full px-6 text-base font-semibold transition-colors"
        >
          Ver todos ({items.length})
        </Link>
      )}
    </div>
  );
}

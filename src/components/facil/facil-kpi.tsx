import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FACIL_ENTER_CLASS, facilEnterStyle, facilTone } from "@/components/facil/facil-tile";

/**
 * Métrica do modo Fácil: um número grande com ícone e uma frase curta. Com
 * `href`, o card inteiro leva para a lista já filtrada (mesmo comportamento
 * dos `KpiCard` do painel formal).
 */
export function FacilKpi({
  icon: Icon,
  label,
  value,
  hint,
  href,
  index = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
  index?: number;
}) {
  const body = (
    <>
      <span className={cn("shrink-0 rounded-full p-3", facilTone(index))}>
        <Icon className="h-7 w-7" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-muted-foreground text-sm">{label}</span>
        <span className="text-3xl font-bold tracking-tight">{value}</span>
        {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
      </span>
    </>
  );
  const className = cn(
    "bg-card flex items-center gap-4 rounded-2xl p-4 shadow-xs ring-1 ring-black/5 dark:ring-white/10",
    FACIL_ENTER_CLASS,
    href && "transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]",
  );
  return href ? (
    <Link href={href} className={className} style={facilEnterStyle(index)}>
      {body}
    </Link>
  ) : (
    <div className={className} style={facilEnterStyle(index)}>
      {body}
    </div>
  );
}

/** Linha de métricas (2 colunas no celular, 3 ou 4 no computador). */
export function FacilKpis({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

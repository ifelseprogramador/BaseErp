import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cores dos cards do modo Fácil, escolhidas pela posição do item (nunca por
 * módulo): um módulo ou ação nova ganha cor sem declarar nada. Classes
 * escritas por extenso para o Tailwind enxergá-las.
 */
export const FACIL_PALETTE = [
  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300",
] as const;

export function facilTone(index: number): string {
  return FACIL_PALETTE[index % FACIL_PALETTE.length];
}

/** Entrada em cascata: cada card aparece um pouco depois do anterior. */
export function facilEnterStyle(index: number): React.CSSProperties {
  return { animationDelay: `${Math.min(index, 12) * 50}ms` };
}

export const FACIL_ENTER_CLASS =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:fill-mode-backwards motion-safe:duration-300";

/**
 * Card-botão do modo Fácil: ícone grande num círculo colorido, rótulo e, se
 * houver, uma frase curta embaixo. Todo o card é o link — alvo de toque
 * grande para quem não tem costume com sistemas.
 */
export function FacilTile({
  href,
  label,
  icon: Icon,
  index = 0,
  size = "md",
  active = false,
  badge,
  description,
  onClick,
  download = false,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  index?: number;
  size?: "md" | "lg";
  active?: boolean;
  badge?: string | number;
  description?: string;
  onClick?: () => void;
  /** Arquivo para baixar (rota de exportação): link comum, sem navegação do Next. */
  download?: boolean;
}) {
  const big = size === "lg";
  const className = cn(
    "group/tile relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 text-center font-semibold",
    FACIL_ENTER_CLASS,
    "transition-all hover:-translate-y-1 hover:shadow-md active:scale-95 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
    big ? "min-h-36 p-4 text-base" : "min-h-24 p-2 text-sm",
    active
      ? "border-primary bg-sidebar-primary/10"
      : "bg-card border-transparent shadow-xs ring-1 ring-black/5 dark:ring-white/10",
  );
  const content = (
    <>
      {badge !== undefined && (
        <span className="bg-primary text-primary-foreground absolute top-2 right-2 min-w-6 rounded-full px-2 py-0.5 text-xs font-bold">
          {badge}
        </span>
      )}
      <span
        className={cn(
          "rounded-full transition-transform group-hover/tile:scale-110 group-hover/tile:-rotate-6 motion-reduce:transition-none motion-reduce:group-hover/tile:transform-none",
          big ? "p-4" : "p-3",
          facilTone(index),
        )}
      >
        <Icon className={big ? "h-9 w-9" : "h-6 w-6"} />
      </span>
      {label}
      {description && (
        <span className="text-muted-foreground text-xs font-normal">{description}</span>
      )}
    </>
  );
  const style = facilEnterStyle(index);
  return download ? (
    <a href={href} download onClick={onClick} style={style} className={className}>
      {content}
    </a>
  ) : (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      style={style}
      className={className}
    >
      {content}
    </Link>
  );
}

/** Grade de cards-ação (Novo, Ver todos, Importar…). */
export function FacilActions({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>;
}

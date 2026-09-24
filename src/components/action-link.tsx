import Link from "next/link";
import { Pencil, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Padrão de TODO link de texto do app (no lugar do sublinhado): no
 * hover/foco ganha um fundo suave na cor primária e um ícone que desliza
 * pra dentro, dizendo o que o clique faz — lápis (padrão) pra abrir/editar
 * um registro, `Download` pra baixar, `Plus` pra criar, `ArrowRight` pra
 * só navegar. O `-mx-1.5 px-1.5` faz o destaque transbordar pra fora sem
 * desalinhar o texto da coluna.
 *
 * `inline`: link no meio de uma frase. O ícone não ocupa espaço até o
 * hover (senão abriria um buraco no texto) e o texto fica sempre na cor
 * primária — sem sublinhado fixo, é isso que mostra que ali é clicável.
 */
export function ActionLink({
  href,
  icon: Icon = Pencil,
  inline = false,
  className,
  children,
}: {
  href: string;
  icon?: LucideIcon;
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group/action -mx-1.5 inline-flex items-center rounded-md px-1.5 transition-colors",
        "hover:bg-primary/10 hover:text-primary focus-visible:bg-primary/10 focus-visible:text-primary",
        "focus-visible:ring-ring/50 outline-none focus-visible:ring-2",
        inline ? "text-primary font-medium" : "gap-1.5 py-0.5",
        className,
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      <Icon
        aria-hidden
        className={cn(
          "h-3.5 shrink-0 -translate-x-1 opacity-0 transition-all duration-200",
          "group-hover/action:translate-x-0 group-hover/action:opacity-100",
          "group-focus-visible/action:translate-x-0 group-focus-visible/action:opacity-100",
          inline
            ? "w-0 group-hover/action:ml-1 group-hover/action:w-3.5 group-focus-visible/action:ml-1 group-focus-visible/action:w-3.5"
            : "w-3.5",
        )}
      />
    </Link>
  );
}

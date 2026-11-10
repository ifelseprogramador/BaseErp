import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { FACIL_ENTER_CLASS } from "@/components/facil/facil-tile";
import { FacilActions } from "@/components/facil/facil-tile";
import { FacilKpis } from "@/components/facil/facil-kpi";

/**
 * Moldura de toda janela do modo Fácil: botão grande de voltar, ícone
 * animado, título curto e só o conteúdo da etapa. Sem tabelas nem barra
 * lateral — quem precisa trocar de módulo usa "Todos os módulos" no topo.
 */
export function FacilPage({
  title,
  subtitle,
  icon: Icon,
  backHref,
  backLabel = "Voltar",
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {backHref && (
          <Link
            href={backHref}
            className="text-muted-foreground hover:text-foreground inline-flex h-11 w-fit items-center gap-2 rounded-full px-3 text-base font-medium transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            {backLabel}
          </Link>
        )}
        <div className="flex items-center gap-4">
          {Icon && (
            <span
              className={`bg-primary/10 text-primary rounded-2xl p-3 ${FACIL_ENTER_CLASS} motion-safe:duration-500`}
            >
              <Icon className="h-9 w-9" />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * Janela inicial de um módulo no modo Fácil: métricas do módulo no topo,
 * cards de ação (Ver todos, Novo, Importar…) e, embaixo, o que for útil ver
 * logo (os últimos registros).
 */
export function FacilModuleHome({
  title,
  subtitle,
  icon,
  kpis,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  kpis?: React.ReactNode;
  actions: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <FacilPage title={title} subtitle={subtitle} icon={icon} backHref="/" backLabel="Início">
      {kpis && <FacilKpis>{kpis}</FacilKpis>}
      <FacilActions>{actions}</FacilActions>
      {children}
    </FacilPage>
  );
}

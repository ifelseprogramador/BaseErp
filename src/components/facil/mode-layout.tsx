import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FacilPage } from "@/components/facil/facil-page";
import { FACIL_ENTER_CLASS } from "@/components/facil/facil-tile";
import type { UiMode } from "@/core/ui-mode";
import { cn } from "@/lib/utils";

/**
 * Moldura de tela ÚNICA para os dois layouts: a mesma tela (mesmo conteúdo,
 * mesmos formulários) vira `ModePage` + `ModeSection`, e só a APRESENTAÇÃO
 * muda — Formal: título e cartões compactos; Fácil: janela com ícone animado,
 * títulos grandes e seções em cartões amplos. Regra de paridade dos layouts
 * (docs/decisoes.md): telas de configuração usam estes dois componentes em vez
 * de ter uma versão por modo.
 */
export function ModePage({
  mode,
  title,
  subtitle,
  icon,
  maxWidth = "max-w-2xl",
  children,
}: {
  mode: UiMode;
  title: string;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  maxWidth?: string;
  children: React.ReactNode;
}) {
  if (mode === "facil") {
    return (
      <FacilPage
        title={title}
        subtitle={typeof subtitle === "string" ? subtitle : undefined}
        icon={icon}
        backHref="/"
        backLabel="Início"
      >
        {typeof subtitle === "string" || !subtitle ? null : subtitle}
        {children}
      </FacilPage>
    );
  }
  return (
    <div className={cn("mx-auto flex flex-col gap-6", maxWidth)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <div className="text-muted-foreground text-sm">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

export function ModeSection({
  mode,
  title,
  description,
  icon: Icon,
  children,
}: {
  mode: UiMode;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  if (mode === "facil") {
    return (
      <section
        className={cn(
          "bg-card flex flex-col gap-4 rounded-2xl p-5 shadow-xs ring-1 ring-black/5 dark:ring-white/10",
          FACIL_ENTER_CLASS,
        )}
      >
        <div className="flex items-center gap-3">
          {Icon && (
            <span className="bg-primary/10 text-primary rounded-full p-3">
              <Icon className="h-6 w-6" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            {description && <p className="text-muted-foreground text-sm">{description}</p>}
          </div>
        </div>
        {children}
      </section>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

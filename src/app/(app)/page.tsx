import { Building2, LayoutDashboard, Package, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveOrg } from "@/core/auth";

/**
 * Dashboard-SHELL: só o layout de KPI cards, sem nenhum dado real —
 * BaseERP não tem módulo de negócio nenhum ainda (ver src/modules/README.md),
 * então não existe um `get<Modulo>DashboardSummary()` pra alimentar isto.
 *
 * Um vertical nascido deste template deve:
 *   1. Trocar os `<KpiCardPlaceholder>` abaixo por `<KpiCard>` reais,
 *      chamando `get<Modulo>DashboardSummary()` exportado pelo barrel de
 *      cada módulo (`modules/<modulo>/index.ts`) — ver o padrão em
 *      `src/modules/README.md`.
 *   2. Rodar essas chamadas em `Promise.all` (como aqui), nunca em série.
 *   3. Manter esta página como Server Component — os dados de dashboard
 *      não precisam de interatividade client-side.
 */
export default async function DashboardPage() {
  const org = await getActiveOrg();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Painel</h1>
        <p className="text-muted-foreground text-sm">{org.organizationName}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCardPlaceholder icon={Users} label="Módulo A" />
        <KpiCardPlaceholder icon={Package} label="Módulo B" />
        <KpiCardPlaceholder icon={Building2} label="Módulo C" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LayoutDashboard className="text-primary h-4 w-4" />
            Nenhum módulo instalado ainda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Este é o BaseERP: um projeto-template sem módulos de negócio. Crie o primeiro módulo em{" "}
            <code className="bg-muted rounded px-1 py-0.5 text-xs">
              src/modules/&lt;modulo&gt;/
            </code>{" "}
            (contrato de arquivos documentado em{" "}
            <code className="bg-muted rounded px-1 py-0.5 text-xs">src/modules/README.md</code>) e
            substitua os cartões acima pelos indicadores reais dele.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCardPlaceholder({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex items-start justify-between gap-2 pt-6">
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="text-muted-foreground/50 text-2xl font-semibold tracking-tight">—</p>
          <p className="text-muted-foreground/70 text-xs">Aguardando módulo</p>
        </div>
        <div className="bg-muted text-muted-foreground rounded-lg p-2">
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

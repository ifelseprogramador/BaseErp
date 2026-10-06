import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuditStamp } from "@/components/audit-stamp";
import { StatusTimeline } from "@/components/status-timeline";
import { withOrg } from "@/core/auth";

/**
 * Cartão "Histórico" da ficha de um registro: linha do tempo de status +
 * "criado por / alterado por". Some inteiro em empresa de um usuário só
 * (sem isso, apareceria um cartão vazio). `entityTable`/`labels` só se o
 * registro tem status; sem eles, mostra só a autoria.
 */
export async function HistoryCard({
  entityTable,
  entityId,
  labels,
  createdBy,
  createdAt,
  updatedBy,
  updatedAt,
}: {
  entityTable?: string;
  entityId?: string;
  labels?: Record<string, string>;
  createdBy: string | null;
  createdAt: Date | null;
  updatedBy: string | null;
  updatedAt: Date | null;
}) {
  const { multiUser } = await withOrg();
  if (!multiUser) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {entityTable && entityId && labels && (
          <StatusTimeline entityTable={entityTable} entityId={entityId} labels={labels} />
        )}
        <AuditStamp
          createdBy={createdBy}
          createdAt={createdAt}
          updatedBy={updatedBy}
          updatedAt={updatedAt}
        />
      </CardContent>
    </Card>
  );
}

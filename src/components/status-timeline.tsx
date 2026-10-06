import { withOrg } from "@/core/auth";
import { formatDateTime } from "@/core/format";
import { listStatusHistory } from "@/core/status-history";
import { getUserDisplayInfoByIds } from "@/core/user-lookup";

/**
 * Linha do tempo de status de uma entidade (quem mudou de qual para qual e
 * quando). `labels` traduz o valor gravado para o texto da tela; o que não
 * estiver no mapa aparece como veio. Só renderiza em empresa
 * multiusuário e quando há histórico.
 */
export async function StatusTimeline({
  entityTable,
  entityId,
  labels,
}: {
  entityTable: string;
  entityId: string;
  labels: Record<string, string>;
}) {
  const { multiUser, organizationId, withDb } = await withOrg();
  if (!multiUser) return null;

  const history = await withDb((tx) =>
    listStatusHistory(tx, organizationId, entityTable, entityId),
  );
  if (history.length === 0) return null;

  const names = await withDb((tx) =>
    getUserDisplayInfoByIds(
      tx,
      history.map((h) => h.changedBy).filter((id): id is string => Boolean(id)),
    ),
  );
  const label = (status: string) => labels[status] ?? status;

  return (
    <ol className="flex flex-col gap-1.5 text-sm">
      {history.map((h) => (
        <li key={h.id} className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-muted-foreground w-36 shrink-0 text-xs tabular-nums">
            {formatDateTime(h.changedAt)}
          </span>
          <span>
            {h.fromStatus ? `${label(h.fromStatus)} → ` : ""}
            <strong className="font-medium">{label(h.toStatus)}</strong>
          </span>
          <span className="text-muted-foreground text-xs">
            por {h.changedBy ? (names.get(h.changedBy)?.name ?? "Usuário removido") : "sistema"}
          </span>
        </li>
      ))}
    </ol>
  );
}

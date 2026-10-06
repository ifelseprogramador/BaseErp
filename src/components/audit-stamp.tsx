import { withOrg } from "@/core/auth";
import { formatDateTime } from "@/core/format";
import { getUserDisplayInfoByIds } from "@/core/user-lookup";

/**
 * "Criado por Fulano em ... · alterado por Beltrano em ..." — só aparece em
 * empresa multiusuário (com uma pessoa só, "quem fez" é sempre a mesma e o
 * texto seria ruído). Use no rodapé da ficha de um registro cujas colunas
 * `createdBy`/`updatedBy` vêm de `auditColumns` (`db/schema/audit.ts`).
 */
export async function AuditStamp({
  createdBy,
  createdAt,
  updatedBy,
  updatedAt,
}: {
  createdBy: string | null;
  createdAt: Date | null;
  updatedBy: string | null;
  updatedAt: Date | null;
}) {
  const { multiUser, withDb } = await withOrg();
  if (!multiUser || (!createdBy && !updatedBy)) return null;

  const ids = [createdBy, updatedBy].filter((id): id is string => Boolean(id));
  const names = await withDb((tx) => getUserDisplayInfoByIds(tx, ids));
  const nameOf = (id: string | null) => (id ? (names.get(id)?.name ?? "Usuário removido") : null);

  const alteradoPorOutro = updatedBy && updatedBy !== createdBy;
  const alteradoDepois =
    updatedAt && createdAt && updatedAt.getTime() - createdAt.getTime() > 60_000;

  return (
    <p className="text-muted-foreground text-xs">
      {createdBy && (
        <>
          Criado por {nameOf(createdBy)}
          {createdAt && <> em {formatDateTime(createdAt)}</>}
        </>
      )}
      {updatedBy && (alteradoPorOutro || alteradoDepois) && (
        <>
          {createdBy && " · "}
          Última alteração por {nameOf(updatedBy)}
          {updatedAt && <> em {formatDateTime(updatedAt)}</>}
        </>
      )}
    </p>
  );
}

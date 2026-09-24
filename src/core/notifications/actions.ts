"use server";

import { revalidatePath } from "next/cache";
import { withOrg } from "@/core/auth";
import type { ActionResult } from "@/core/action-result";
import { notificationReads } from "@/db/schema/notifications";
import { listNotificationsForCurrentUser } from "./queries";

/** Marca como lida pra ESTA pessoa (`userId`) — não afeta o resto da
 * organização, cada pessoa tem sua própria leitura. `onConflictDoNothing`
 * porque `(notificationId, userId)` é único: clicar duas vezes (ou dois
 * componentes tentando marcar ao mesmo tempo) não é erro. */
export async function markNotificationRead(notificationId: string): Promise<ActionResult> {
  const { organizationId, userId, log, withDb } = await withOrg();

  await withDb((db) =>
    db
      .insert(notificationReads)
      .values({ notificationId, userId, organizationId })
      .onConflictDoNothing(),
  );

  log.info("notificacoes.marcar_lida", { notificationId });
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Apaga do sino de ESTA pessoa — a notificação continua existindo pro
 * resto da organização (e pro dono, que ainda vê a pessoa como leitora).
 * Upsert porque ela pode já ter uma linha de leitura (ou não, se apagou
 * sem abrir). Só aceita ids que ela de fato enxerga, pra não criar
 * linha de leitura em notificação de outra organização.
 */
export async function dismissNotifications(
  notificationIds: string[] | "all",
): Promise<ActionResult> {
  const { organizationId, userId, log, withDb } = await withOrg();

  const visibleIds = (await listNotificationsForCurrentUser()).map((n) => n.id);
  const ids =
    notificationIds === "all"
      ? visibleIds
      : notificationIds.filter((id) => visibleIds.includes(id));
  if (ids.length === 0) return { ok: true };

  const now = new Date();
  await withDb((db) =>
    db
      .insert(notificationReads)
      .values(
        ids.map((notificationId) => ({ notificationId, userId, organizationId, dismissedAt: now })),
      )
      .onConflictDoUpdate({
        target: [notificationReads.notificationId, notificationReads.userId],
        set: { dismissedAt: now },
      }),
  );

  log.info("notificacoes.apagar_do_sino", { count: ids.length, todas: notificationIds === "all" });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Relida pelo sino quando chega um aviso de "mudou" pelo Realtime (ver
 * ./realtime.ts) — mesma consulta do layout, então a filtragem por
 * organização continua no servidor. */
export async function fetchMyNotifications() {
  return listNotificationsForCurrentUser();
}

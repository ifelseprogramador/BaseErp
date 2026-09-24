"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/core/admin-auth";
import type { ActionResult } from "@/core/action-result";
import type { Logger } from "@/core/logger";
import { sendBroadcast } from "@/core/supabase/realtime-sender";
import { notifications } from "@/db/schema/notifications";
import {
  allNotificationsChannelName,
  NOTIFICATIONS_CHANGED_EVENT,
  orgNotificationsChannelName,
} from "./realtime";
import { parseNotificationFormData } from "./validation";

/**
 * Avisa os sinos abertos que a lista mudou (ver ./realtime.ts). Falha no
 * Realtime só é logada: a notificação já está salva no banco e aparece
 * de qualquer jeito no próximo carregamento de página — não vale
 * devolver erro pro dono por causa disso.
 */
async function broadcastChanged(organizationIds: (string | null)[], log: Logger) {
  const channels = new Set(
    organizationIds.map((id) =>
      id ? orgNotificationsChannelName(id) : allNotificationsChannelName(),
    ),
  );
  try {
    await Promise.all(
      [...channels].map((channel) => sendBroadcast(channel, NOTIFICATIONS_CHANGED_EVENT, {})),
    );
  } catch (err) {
    log.error("notificacoes.broadcast_falhou", { err });
  }
}

export async function createNotification(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { userId, log, withDb } = await requireAdmin();

  const parsed = parseNotificationFormData(formData);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }

  const notification = await withDb(async (db) => {
    const [row] = await db
      .insert(notifications)
      .values({
        title: parsed.data.title,
        body: parsed.data.body,
        category: parsed.data.category,
        organizationId: parsed.data.organizationId ?? null,
        createdBy: userId,
      })
      .returning({ id: notifications.id });
    return row;
  });

  log.info("notificacoes.criar", {
    notificationId: notification.id,
    organizationId: parsed.data.organizationId ?? "todas",
  });
  await broadcastChanged([parsed.data.organizationId ?? null], log);
  revalidatePath("/admin/notificacoes");
  redirect("/admin/notificacoes");
}

export async function updateNotification(
  notificationId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { log, withDb } = await requireAdmin();

  const parsed = parseNotificationFormData(formData);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }

  const { previousOrganizationId, updated } = await withDb(async (db) => {
    const [previous] = await db
      .select({ organizationId: notifications.organizationId })
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1);

    const result = await db
      .update(notifications)
      .set({
        title: parsed.data.title,
        body: parsed.data.body,
        category: parsed.data.category,
        organizationId: parsed.data.organizationId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(notifications.id, notificationId))
      .returning({ id: notifications.id });

    return { previousOrganizationId: previous?.organizationId ?? null, updated: result.length > 0 };
  });

  if (!updated) {
    return { ok: false, message: "Notificação não encontrada." };
  }

  log.info("notificacoes.atualizar", { notificationId });
  // Destino antigo E novo: se o dono trocou de organização, a antiga
  // precisa sumir com o aviso e a nova, recebê-lo.
  await broadcastChanged([previousOrganizationId, parsed.data.organizationId ?? null], log);
  revalidatePath("/admin/notificacoes");
  return { ok: true };
}

export async function deleteNotification(notificationId: string): Promise<ActionResult> {
  const { log, withDb } = await requireAdmin();

  const deleted = await withDb((db) =>
    db
      .delete(notifications)
      .where(eq(notifications.id, notificationId))
      .returning({ organizationId: notifications.organizationId }),
  );

  log.info("notificacoes.remover", { notificationId });
  if (deleted.length > 0) await broadcastChanged([deleted[0].organizationId], log);
  revalidatePath("/admin/notificacoes");
  return { ok: true };
}

export async function deleteAllNotifications(): Promise<ActionResult> {
  const { log, withDb } = await requireAdmin();

  await withDb((db) => db.delete(notifications));

  log.info("notificacoes.remover_todas");
  // O canal "todas" basta: todo sino escuta ele além do da própria organização.
  await broadcastChanged([null], log);
  revalidatePath("/admin/notificacoes");
  return { ok: true };
}

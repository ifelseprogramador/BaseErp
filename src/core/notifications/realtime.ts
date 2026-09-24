/**
 * Canais de Realtime Broadcast das notificações do dono — mesmo modelo
 * do suporte ao vivo (ver core/live-support/realtime.ts): o Broadcast só
 * avisa "algo mudou, releia", sem conteúdo nenhum no payload. O sino
 * relê a lista por Server Action (`fetchMyNotifications`), que continua
 * filtrando pela organização de quem está logado — o que chega pelo
 * canal nunca é a fonte da verdade.
 */

/** Notificações "pra todas as organizações" (`organization_id` nulo). */
export function allNotificationsChannelName() {
  return "notifications:all";
}

/** Notificações só pra uma organização. */
export function orgNotificationsChannelName(organizationId: string) {
  return `notifications-org:${organizationId}`;
}

export const NOTIFICATIONS_CHANGED_EVENT = "changed";

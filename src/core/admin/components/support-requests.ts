/** Linha de pedido de suporte mostrada na caixa de entrada e no sino do admin. */
export interface SupportRequestItem {
  sessionId: string;
  organizationId: string;
  organizationName: string;
  userName: string;
  /** `pending` = pessoa ainda esperando (dá para atender agora);
   * `missed` = ninguém atendeu (pedir acesso à tela, a pessoa aprova);
   * `chat` = conversa só por texto em andamento (veio do Telegram). */
  status: "pending" | "missed" | "chat";
}

/** Payload dos broadcasts `request`/`missed` do canal da caixa de entrada. */
export function itemFromBroadcast(
  payload: Record<string, unknown>,
  status: SupportRequestItem["status"],
): SupportRequestItem {
  return {
    sessionId: payload.sessionId as string,
    organizationId: payload.organizationId as string,
    organizationName: (payload.organizationName as string) ?? "Organização",
    userName: (payload.userName as string) ?? "Usuário",
    status,
  };
}

/** Atualiza a lista: um pedido `missed` substitui o `pending` da mesma sessão. */
export function upsertRequest(
  list: SupportRequestItem[],
  item: SupportRequestItem,
): SupportRequestItem[] {
  return [item, ...list.filter((r) => r.sessionId !== item.sessionId)];
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Bell, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/core/format";
import { logger } from "@/core/logger";
import { getRealtimeChannel } from "@/core/live-support/realtime";
import { dismissNotifications, fetchMyNotifications, markNotificationRead } from "../actions";
import { NOTIFICATION_CATEGORY_META } from "../category";
import {
  allNotificationsChannelName,
  NOTIFICATIONS_CHANGED_EVENT,
  orgNotificationsChannelName,
} from "../realtime";
import type { NotificationCategory } from "../validation";

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  createdAt: Date;
  readAt: Date | null;
}

/**
 * Sino de avisos que o dono da plataforma manda — no cabeçalho de toda
 * página autenticada (`(app)/layout.tsx`), não só um módulo. Marca como
 * lida ao ABRIR o dropdown (não precisa clicar em cada uma) — mesmo
 * modelo mental de e-mail/notificação de celular.
 *
 * Ao vivo: escuta o canal "todas" e o da própria organização
 * (./realtime.ts). Quando o dono envia/edita/apaga, relê a lista no
 * servidor e mostra um toast só das que ainda não estavam aqui — depois
 * de alguns segundos o toast some e a notificação fica só no sino, como
 * não lida.
 */
export function NotificationBell({
  organizationId,
  initialItems,
}: {
  organizationId: string;
  initialItems: NotificationItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [, startTransition] = useTransition();
  const unreadCount = items.filter((i) => !i.readAt).length;
  // Ids já mostrados — em ref (não state) porque o handler do canal é
  // registrado uma vez só e leria um `items` velho pela closure.
  const knownIds = useRef(new Set(initialItems.map((i) => i.id)));
  // "Apagar todas" pede um segundo clique pra confirmar — sem modal por
  // cima do dropdown, e sem apagar tudo num clique sem querer.
  const [confirmingClearAll, setConfirmingClearAll] = useState(false);

  useEffect(() => {
    async function reload() {
      const fresh = await fetchMyNotifications();
      const arrived = fresh.filter((i) => !knownIds.current.has(i.id) && !i.readAt);
      knownIds.current = new Set(fresh.map((i) => i.id));
      setItems(fresh);
      // Mais antiga primeiro, pra a mais nova ficar no topo da pilha.
      for (const item of arrived.reverse()) {
        const meta = NOTIFICATION_CATEGORY_META[item.category];
        const Icon = meta.icon;
        toast(item.title, {
          description: item.body,
          icon: (
            <span className={`rounded-md p-1 ${meta.className}`}>
              <Icon className="h-3.5 w-3.5" />
            </span>
          ),
          duration: 8000,
        });
      }
    }

    const channels = [
      allNotificationsChannelName(),
      orgNotificationsChannelName(organizationId),
    ].map((name) =>
      getRealtimeChannel(name)
        .on("broadcast", { event: NOTIFICATIONS_CHANGED_EVENT }, () => {
          reload().catch((err) => logger.error("notificacoes.recarregar_falhou", { err }));
        })
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            logger.error("notificacoes.canal_falhou", { name, status, err });
          }
        }),
    );
    return () => {
      for (const channel of channels) channel.unsubscribe();
    };
  }, [organizationId]);

  function handleDismiss(ids: string[] | "all") {
    const previous = items;
    setItems((prev) => (ids === "all" ? [] : prev.filter((i) => !ids.includes(i.id))));
    setConfirmingClearAll(false);
    startTransition(async () => {
      const result = await dismissNotifications(ids);
      if (!result.ok) {
        setItems(previous);
        toast.error(result.message ?? "Não foi possível apagar.");
      }
    });
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setConfirmingClearAll(false);
      return;
    }
    const unread = items.filter((i) => !i.readAt);
    if (unread.length === 0) return;
    setItems((prev) => prev.map((i) => (i.readAt ? i : { ...i, readAt: new Date() })));
    startTransition(() => {
      for (const item of unread) {
        void markNotificationRead(item.id);
      }
    });
  }

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Notificações" className="relative" />
        }
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="bg-destructive absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup>
          <div className="flex items-center justify-between gap-2 pr-1">
            <DropdownMenuLabel>Notificações</DropdownMenuLabel>
            {items.length > 0 && (
              <Button
                variant="ghost"
                size="xs"
                className={
                  confirmingClearAll
                    ? "text-destructive hover:text-destructive"
                    : "text-muted-foreground"
                }
                onClick={() =>
                  confirmingClearAll ? handleDismiss("all") : setConfirmingClearAll(true)
                }
              >
                {confirmingClearAll ? "Confirmar: apagar todas" : "Apagar todas"}
              </Button>
            )}
          </div>
          <DropdownMenuSeparator />
          {items.length === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-center text-sm">
              Nenhuma notificação ainda.
            </p>
          ) : (
            <ul className="flex max-h-80 flex-col divide-y overflow-y-auto">
              {items.map((item) => {
                const meta = NOTIFICATION_CATEGORY_META[item.category];
                const Icon = meta.icon;
                return (
                  <li key={item.id} className="group/item flex gap-2 px-2 py-2.5 text-sm">
                    <div className={`mt-0.5 shrink-0 rounded-md p-1 ${meta.className}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        {!item.readAt && (
                          <span className="bg-primary h-1.5 w-1.5 shrink-0 rounded-full" />
                        )}
                        <span className="truncate font-medium">{item.title}</span>
                      </div>
                      <p className="text-muted-foreground text-xs whitespace-pre-wrap">
                        {item.body}
                      </p>
                      <span className="text-muted-foreground text-[11px]">
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                    {/* Sempre visível no toque (celular não tem hover);
                        no desktop aparece ao passar o mouse na linha. */}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Apagar "${item.title}"`}
                      title="Apagar"
                      className="text-muted-foreground hover:text-destructive shrink-0 self-start transition-opacity sm:opacity-0 sm:group-hover/item:opacity-100 sm:focus-visible:opacity-100"
                      onClick={() => handleDismiss([item.id])}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

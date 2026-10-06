"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logger } from "@/core/logger";
import { adminSupportInboxChannelName, getRealtimeChannel } from "@/core/live-support/realtime";
import { acceptSupportRequest, requestAccessToSession } from "@/core/live-support/actions";
import { itemFromBroadcast, upsertRequest, type SupportRequestItem } from "./support-requests";

/**
 * Sino no cabeçalho do admin (visível em toda página `/admin/*`, não só
 * na inicial onde fica o `SupportInbox` completo) — sem isto, um pedido
 * de "chamar suporte" só aparecia pra quem já estivesse na tela inicial;
 * o admin numa ficha de organização não via nada até voltar. Clicar num
 * pedido aceita e já navega pra ficha da organização, pronta pra sessão
 * ficar `active`.
 */
export function SupportNotificationBell({
  initialRequests,
}: {
  initialRequests: SupportRequestItem[];
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const channel = getRealtimeChannel(adminSupportInboxChannelName());
    channel
      .on("broadcast", { event: "request" }, ({ payload }) => {
        const item = itemFromBroadcast(payload, "pending");
        setRequests((prev) => upsertRequest(prev, item));
        toast.info(`${item.userName} (${item.organizationName}) está chamando o suporte`, {
          description: "Clique no sino para atender.",
        });
      })
      .on("broadcast", { event: "missed" }, ({ payload }) => {
        const item = itemFromBroadcast(payload, "missed");
        setRequests((prev) => upsertRequest(prev, item));
      })
      .subscribe((subscribeStatus, err) => {
        if (subscribeStatus === "CHANNEL_ERROR" || subscribeStatus === "TIMED_OUT") {
          logger.error("live_support.canal_inbox_falhou", { subscribeStatus, err });
        }
      });
    return () => {
      channel.unsubscribe();
    };
  }, []);

  function handleAccept(request: SupportRequestItem) {
    const { sessionId, organizationId } = request;
    startTransition(async () => {
      const result =
        request.status === "pending"
          ? await acceptSupportRequest(sessionId)
          : await requestAccessToSession(sessionId);
      if (result.ok) {
        setRequests((prev) => prev.filter((r) => r.sessionId !== sessionId));
        // Recarregamento completo (não router.push) de propósito: o
        // router do Next.js pode reaproveitar um prefetch anterior da
        // mesma rota, capturado ANTES da sessão virar ativa — a tela
        // mostrava "Ao vivo" por um instante e voltava sozinha pra
        // "Solicitar acesso" quando esse prefetch velho resolvia por
        // cima, sem erro nenhum. Uma navegação cheia garante UMA busca
        // sempre fresca, sem essa corrida.
        window.location.href = `/admin/organizacoes/${organizationId}`;
      } else {
        toast.error(result.message ?? "Não foi possível aceitar.");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Pedidos de suporte"
            className="relative text-zinc-50"
          />
        }
      >
        <Bell className="h-4 w-4" />
        {requests.length > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
            {requests.length}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Pedidos de suporte</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {requests.length === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-center text-sm">
              Nenhum pedido no momento.
            </p>
          ) : (
            requests.map((r) => (
              <DropdownMenuItem
                key={r.sessionId}
                disabled={isPending}
                onClick={() => handleAccept(r)}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">
                    {r.userName} — {r.organizationName}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {r.status === "pending" ? "Esperando agora" : "Sem atendimento — pedir acesso"}
                  </span>
                </span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { ActionLink } from "@/components/action-link";
import { toast } from "sonner";
import { Headset } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logger } from "@/core/logger";
import { adminSupportInboxChannelName, getRealtimeChannel } from "@/core/live-support/realtime";
import { acceptSupportRequest, requestAccessToSession } from "@/core/live-support/actions";
import { itemFromBroadcast, upsertRequest, type SupportRequestItem } from "./support-requests";

/**
 * Pedidos de suporte abertos por pessoas ("Chamar suporte" dentro do app), em
 * tempo real, mesmo sem estar na ficha da organização. Dois estados:
 * - esperando atendimento: "Atender agora" abre a sessão na hora (a pessoa
 *   está olhando a contagem);
 * - perdido (ninguém online / tempo esgotado): "Pedir acesso à tela" — a
 *   pessoa recebe o aviso de consentimento e aprova quando estiver lá.
 * `initialRequests` cobre a página já carregada antes do pedido chegar.
 */
export function SupportInbox({ initialRequests }: { initialRequests: SupportRequestItem[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const channel = getRealtimeChannel(adminSupportInboxChannelName());
    channel
      .on("broadcast", { event: "request" }, ({ payload }) => {
        setRequests((prev) => upsertRequest(prev, itemFromBroadcast(payload, "pending")));
      })
      .on("broadcast", { event: "missed" }, ({ payload }) => {
        setRequests((prev) => upsertRequest(prev, itemFromBroadcast(payload, "missed")));
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

  function handle(request: SupportRequestItem) {
    startTransition(async () => {
      const result =
        request.status === "pending"
          ? await acceptSupportRequest(request.sessionId)
          : await requestAccessToSession(request.sessionId);
      if (result.ok) {
        setRequests((prev) => prev.filter((r) => r.sessionId !== request.sessionId));
        if (request.status === "missed") {
          toast.success(`Pedido enviado a ${request.userName}. Ela precisa aprovar na tela dela.`);
        }
        // Recarregamento completo — ver comentário equivalente em
        // support-notification-bell.tsx (router.push podia reaproveitar
        // um prefetch antigo da mesma rota, capturado antes da sessão
        // mudar de estado).
        window.location.href = `/admin/organizacoes/${request.organizationId}`;
      } else {
        toast.error(result.message ?? "Não foi possível abrir o atendimento.");
      }
    });
  }

  if (requests.length === 0) return null;

  return (
    <Card className="border-blue-500/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Headset className="h-4 w-4" />
          Pedidos de suporte
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {requests.map((r) => (
          <div
            key={r.sessionId}
            className="flex flex-wrap items-center justify-between gap-2 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{r.userName}</p>
              <p className="text-muted-foreground flex items-center gap-2 text-xs">
                <ActionLink href={`/admin/organizacoes/${r.organizationId}`}>
                  {r.organizationName}
                </ActionLink>
                <Badge variant={r.status === "pending" ? "default" : "secondary"}>
                  {r.status === "pending" ? "Esperando agora" : "Sem atendimento"}
                </Badge>
              </p>
            </div>
            <Button size="sm" onClick={() => handle(r)} disabled={isPending}>
              {r.status === "pending" ? "Atender agora" : "Pedir acesso à tela"}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

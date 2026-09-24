"use client";

import { useEffect, useState, useTransition } from "react";
import { ActionLink } from "@/components/action-link";
import { toast } from "sonner";
import { Headset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logger } from "@/core/logger";
import { adminSupportInboxChannelName, getRealtimeChannel } from "@/core/live-support/realtime";
import { acceptSupportRequest } from "@/core/live-support/actions";

interface PendingRequest {
  sessionId: string;
  organizationId: string;
  organizationName: string;
}

/**
 * Mostra pedidos de suporte abertos por organizações ("Chamar suporte"
 * dentro do app) em tempo real, mesmo sem estar na ficha daquela
 * organização. `initialRequests` cobre o caso de a página já ter sido
 * carregada antes do pedido chegar (refresh não perde o que já estava
 * pendente no banco).
 */
export function SupportInbox({ initialRequests }: { initialRequests: PendingRequest[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const channel = getRealtimeChannel(adminSupportInboxChannelName());
    channel
      .on("broadcast", { event: "request" }, ({ payload }) => {
        setRequests((prev) => [
          ...prev,
          {
            sessionId: payload.sessionId as string,
            organizationId: payload.organizationId as string,
            organizationName: (payload.organizationName as string) ?? "Organização",
          },
        ]);
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

  function handleAccept(sessionId: string, organizationId: string) {
    startTransition(async () => {
      const result = await acceptSupportRequest(sessionId);
      if (result.ok) {
        setRequests((prev) => prev.filter((r) => r.sessionId !== sessionId));
        // Recarregamento completo — ver comentário equivalente em
        // support-notification-bell.tsx (router.push podia reaproveitar
        // um prefetch antigo da mesma rota, capturado antes da sessão
        // virar ativa).
        window.location.href = `/admin/organizacoes/${organizationId}`;
      } else {
        toast.error(result.message ?? "Não foi possível aceitar.");
      }
    });
  }

  if (requests.length === 0) return null;

  return (
    <Card className="border-blue-500/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Headset className="h-4 w-4" />
          Pedidos de suporte pendentes
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {requests.map((r) => (
          <div key={r.sessionId} className="flex items-center justify-between text-sm">
            <ActionLink href={`/admin/organizacoes/${r.organizationId}`}>
              {r.organizationName}
            </ActionLink>
            <Button
              size="sm"
              onClick={() => handleAccept(r.sessionId, r.organizationId)}
              disabled={isPending}
            >
              Aceitar
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

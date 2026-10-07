"use client";

import { useEffect, useState, useTransition } from "react";
import { ActionLink } from "@/components/action-link";
import { toast } from "sonner";
import { Headset, MessageSquare, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { logger } from "@/core/logger";
import { adminSupportInboxChannelName, getRealtimeChannel } from "@/core/live-support/realtime";
import {
  acceptSupportRequest,
  endLiveSession,
  requestAccessToSession,
  sendAdminMessage,
} from "@/core/live-support/actions";
import { playChatSound } from "@/core/live-support/chat-sound";
import { MAX_CHAT_MESSAGE_LENGTH } from "@/core/live-support/wait";
import { itemFromBroadcast, upsertRequest, type SupportRequestItem } from "./support-requests";

/**
 * Pedidos de suporte abertos por pessoas ("Chamar suporte" dentro do app), em
 * tempo real, mesmo sem estar na ficha da organização. Cada pedido tem:
 * - a ação principal (atender agora / pedir acesso à tela / abrir conversa);
 * - "Enviar mensagem": escreve para a pessoa SEM pedir a tela — o pedido vira uma
 *   conversa por texto (como se tivesse respondido pelo Telegram);
 * - "Encerrar": descarta um pedido que não precisa mais.
 * `initialRequests` cobre a página já carregada antes do pedido chegar.
 */
export function SupportInbox({ initialRequests }: { initialRequests: SupportRequestItem[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [isPending, startTransition] = useTransition();
  const [composing, setComposing] = useState<SupportRequestItem | null>(null);
  const [draft, setDraft] = useState("");
  const [closing, setClosing] = useState<SupportRequestItem | null>(null);

  useEffect(() => {
    const channel = getRealtimeChannel(adminSupportInboxChannelName());
    channel
      .on("broadcast", { event: "request" }, ({ payload }) => {
        setRequests((prev) => upsertRequest(prev, itemFromBroadcast(payload, "pending")));
      })
      .on("broadcast", { event: "missed" }, ({ payload }) => {
        setRequests((prev) => upsertRequest(prev, itemFromBroadcast(payload, "missed")));
      })
      .on("broadcast", { event: "chat-message" }, ({ payload }) => {
        // A pessoa escreveu numa conversa por texto: o pedido vira/continua `chat`.
        setRequests((prev) => upsertRequest(prev, itemFromBroadcast(payload, "chat")));
        playChatSound();
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

  function handlePrimary(request: SupportRequestItem) {
    // Conversa por texto em andamento: só abre a ficha, onde está a caixa de
    // conversa e o botão "Pedir acesso à tela".
    if (request.status === "chat") {
      window.location.assign(`/admin/organizacoes/${request.organizationId}`);
      return;
    }
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
        window.location.assign(`/admin/organizacoes/${request.organizationId}`);
      } else {
        toast.error(result.message ?? "Não foi possível abrir o atendimento.");
      }
    });
  }

  function handleSend() {
    const target = composing;
    const body = draft.trim();
    if (!target || !body) return;
    startTransition(async () => {
      const result = await sendAdminMessage(target.sessionId, body);
      if (result.ok) {
        toast.success(`Mensagem enviada a ${target.userName}.`);
        setRequests((prev) => upsertRequest(prev, { ...target, status: "chat" }));
        setComposing(null);
        setDraft("");
      } else {
        toast.error(result.message ?? "Não foi possível enviar a mensagem.");
      }
    });
  }

  function handleClose() {
    const target = closing;
    if (!target) return;
    startTransition(async () => {
      const result = await endLiveSession(target.sessionId);
      if (result.ok) {
        setRequests((prev) => prev.filter((r) => r.sessionId !== target.sessionId));
        toast.success("Pedido encerrado.");
        setClosing(null);
      } else {
        toast.error(result.message ?? "Não foi possível encerrar o pedido.");
      }
    });
  }

  if (requests.length === 0) return null;

  return (
    <>
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
                    {r.status === "pending"
                      ? "Esperando agora"
                      : r.status === "chat"
                        ? "Conversa por texto"
                        : "Sem atendimento"}
                  </Badge>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => handlePrimary(r)} disabled={isPending}>
                  {r.status === "pending"
                    ? "Atender agora"
                    : r.status === "chat"
                      ? "Abrir conversa"
                      : "Pedir acesso à tela"}
                </Button>
                {r.status !== "chat" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setComposing(r)}
                    disabled={isPending}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Enviar mensagem
                  </Button>
                )}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setClosing(r)}
                  disabled={isPending}
                  aria-label={`Encerrar o pedido de ${r.userName}`}
                  title="Encerrar este pedido"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={composing !== null} onOpenChange={(open) => !open && setComposing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mensagem para {composing?.userName}</DialogTitle>
            <DialogDescription>
              Ela recebe na caixa de conversa do sistema, sem precisar liberar a tela. Você segue
              conversando pela ficha da empresa e, quando quiser, pede acesso à tela dentro da
              própria conversa.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_CHAT_MESSAGE_LENGTH}
            rows={4}
            placeholder="Escreva a mensagem..."
            aria-label="Mensagem"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposing(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSend} disabled={isPending || !draft.trim()}>
              {isPending ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closing !== null} onOpenChange={(open) => !open && setClosing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar o pedido de {closing?.userName}?</DialogTitle>
            <DialogDescription>
              O pedido some desta lista
              {closing?.status !== "missed" ? " e a caixa de conversa dela é fechada" : ""}. Use
              quando o assunto já foi resolvido por outro meio.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClosing(null)} disabled={isPending}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleClose} disabled={isPending}>
              {isPending ? "Encerrando..." : "Encerrar pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

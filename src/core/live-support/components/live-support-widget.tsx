"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { eventWithTime } from "@rrweb/types";
import { toast } from "sonner";
import { Headset, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { logger } from "@/core/logger";
import { getRealtimeChannel, liveSessionChannelName, orgSupportChannelName } from "../realtime";
import { applyControlEvent } from "../apply-control-event";
import type { ControlEvent } from "../control-events";
import {
  approveSupportSession,
  callForSupport,
  declineSupportSession,
  endLiveSession,
  saveFullSnapshot,
  setControlGranted,
} from "../actions";

export interface LiveSessionState {
  id: string;
  status: "pending" | "active";
  initiatedBy: "admin" | "user";
  controlGranted: boolean;
}

/**
 * Widget do lado do usuário da organização: espera pedido do admin (modal
 * de consentimento), deixa chamar o suporte, grava e transmite a tela
 * (rrweb) enquanto a sessão está `active`, e aplica os eventos de
 * controle remoto quando `controlGranted` é true. Montado uma vez em
 * `(app)/layout.tsx` — sobrevive à navegação entre páginas (é o mesmo
 * componente da árvore do layout), então a gravação não reinicia a cada
 * clique em um link.
 */
export function LiveSupportWidget({
  organizationId,
  initialSession,
}: {
  organizationId: string;
  initialSession: LiveSessionState | null;
}) {
  const [session, setSession] = useState<LiveSessionState | null>(initialSession);
  const [isPending, startTransition] = useTransition();
  const sessionRef = useRef(session);
  const stopRecordingRef = useRef<(() => void) | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Escuta pedidos que o admin abrir para esta organização, mesmo sem sessão aberta.
  useEffect(() => {
    const channel = getRealtimeChannel(orgSupportChannelName(organizationId));
    channel
      .on("broadcast", { event: "request" }, ({ payload }) => {
        if (sessionRef.current) return;
        setSession({
          id: payload.sessionId as string,
          status: "pending",
          initiatedBy: "admin",
          controlGranted: false,
        });
      })
      .subscribe((subscribeStatus, err) => {
        if (subscribeStatus === "CHANNEL_ERROR" || subscribeStatus === "TIMED_OUT") {
          logger.error("live_support.canal_org_falhou", { organizationId, subscribeStatus, err });
        }
      });
    return () => {
      channel.unsubscribe();
    };
  }, [organizationId]);

  // Canal da sessão atual (status, controle, e o transporte do rrweb quando ativa).
  useEffect(() => {
    if (!session) return;

    const channel = getRealtimeChannel(liveSessionChannelName(session.id));
    channel
      .on("broadcast", { event: "status" }, ({ payload }) => {
        const status = payload.status as string;
        if (status === "ended" || status === "declined") {
          setSession(null);
        } else {
          setSession((prev) => (prev ? { ...prev, status: status as "active" } : prev));
        }
      })
      .on("broadcast", { event: "control" }, ({ payload }) => {
        setSession((prev) => (prev ? { ...prev, controlGranted: Boolean(payload.granted) } : prev));
      })
      .on("broadcast", { event: "control-input" }, ({ payload }) => {
        if (sessionRef.current?.controlGranted) {
          applyControlEvent(payload as ControlEvent, cursorRef.current);
        }
      })
      .subscribe((subscribeStatus, err) => {
        if (subscribeStatus === "CHANNEL_ERROR" || subscribeStatus === "TIMED_OUT") {
          logger.error("live_support.canal_sessao_falhou", {
            sessionId: session.id,
            subscribeStatus,
            err,
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- de propósito: só quer resubscrever quando o id da sessão muda, não a cada status/controlGranted que este mesmo efeito produz (senão reconecta o canal em loop)
  }, [session?.id]);

  // Liga/desliga a gravação junto do status virar/deixar de ser "active".
  useEffect(() => {
    if (session && session.status === "active" && !stopRecordingRef.current) {
      let cancelled = false;
      const channel = getRealtimeChannel(liveSessionChannelName(session.id));
      // `import()` dinâmico de propósito: rrweb só entra no bundle do
      // navegador quando uma sessão de suporte fica ativa de verdade —
      // este componente monta em `(app)/layout.tsx`, pra TODA página
      // autenticada, então um `import` estático no topo do arquivo
      // faria toda pessoa baixar essa biblioteca (relativamente grande,
      // só usada nesse caso raro) mesmo sem nunca chamar suporte.
      import("rrweb").then(({ record, EventType }) => {
        if (cancelled) return;
        let lastMeta: eventWithTime | null = null;
        const stop = record({
          emit(event: eventWithTime) {
            if (event.type === EventType.Meta) {
              // O rrweb começa o iframe do Replayer com `display: none` e só
              // revela (`display: inherit`) ao aplicar um Meta — carrega a
              // largura/altura da tela gravada. Guarda aqui pra mandar junto
              // do instantâneo completo (ver abaixo): se o Meta fosse só
              // pelo Broadcast, sofreria da mesma corrida que o instantâneo
              // sofria antes (perdido se o admin ainda não tiver se
              // inscrito) — só que Meta sempre chega perto do início da
              // gravação, quando o admin tem MENOS tempo de estar pronto,
              // então na prática se perdia mais (o conteúdo até renderizava
              // dentro do iframe, mas ele continuava invisível).
              lastMeta = event;
            }
            if (event.type === EventType.FullSnapshot) {
              // O instantâneo completo (o DOM inteiro da página) passa dos
              // 200KB até numa organização vazia — bem acima do limite de
              // tamanho de mensagem do Realtime Broadcast, que aceita o
              // envio (retorna "ok") mas descarta silenciosamente rio
              // abaixo. Por isso vai persistido via Server Action (o admin
              // busca sob demanda), nunca pelo Broadcast. Só os eventos
              // incrementais (poucas centenas de bytes cada) vão por aqui.
              void saveFullSnapshot(session.id, { meta: lastMeta, snapshot: event }).then(
                (result) => {
                  if (!result.ok) {
                    logger.error("live_support.snapshot_falhou", { sessionId: session.id });
                  }
                },
              );
              return;
            }
            void channel.send({ type: "broadcast", event: "rrweb", payload: event });
          },
        });
        stopRecordingRef.current = stop ?? null;
      });
      return () => {
        cancelled = true;
      };
    }
    if (session?.status !== "active" && stopRecordingRef.current) {
      stopRecordingRef.current();
      stopRecordingRef.current = null;
    }
  }, [session]);

  useEffect(() => {
    return () => {
      stopRecordingRef.current?.();
    };
  }, []);

  function handleApprove() {
    if (!session) return;
    startTransition(async () => {
      await approveSupportSession(session.id);
      setSession((prev) => (prev ? { ...prev, status: "active" } : prev));
    });
  }

  function handleDecline() {
    if (!session) return;
    const id = session.id;
    setSession(null);
    startTransition(async () => {
      await declineSupportSession(id);
    });
  }

  function handleCallForSupport() {
    startTransition(async () => {
      const result = await callForSupport();
      if (result.ok && result.sessionId) {
        setSession({
          id: result.sessionId,
          status: "pending",
          initiatedBy: "user",
          controlGranted: false,
        });
      } else {
        toast.error(result.message ?? "Não foi possível chamar o suporte.");
      }
    });
  }

  function handleEnd() {
    if (!session) return;
    const id = session.id;
    setSession(null);
    startTransition(async () => {
      await endLiveSession(id);
    });
  }

  function handleToggleControl(granted: boolean) {
    if (!session) return;
    setSession((prev) => (prev ? { ...prev, controlGranted: granted } : prev));
    startTransition(async () => {
      await setControlGranted(session.id, granted);
    });
  }

  return (
    <>
      {!session && (
        <Button
          variant="outline"
          title="Chamar suporte"
          className="bg-background fixed right-4 bottom-4 z-50 h-10 gap-2 overflow-hidden rounded-full px-3 shadow-lg transition-[padding] duration-300 ease-out"
          onClick={handleCallForSupport}
          disabled={isPending}
        >
          <Headset className="h-4 w-4 shrink-0" />
          {/* Some fechado por padrão (max-width 0) e cresce ao passar o
              mouse — como o botão fica ancorado com `right-4` (posição
              fixa), o crescimento da largura empurra a borda ESQUERDA pra
              fora, dando a impressão de expandir pra esquerda, sem
              precisar de nenhum cálculo de posição. */}
          {/* `@media(hover:hover)` de propósito: sem isso, num celular
              (touch, sem mouse de verdade) o toque no botão ativa o
              `:hover` do CSS e o texto fica "grudado" aberto até tocar em
              outro lugar da tela — parece um bug de texto aparecendo sem
              passar o mouse. Só expande em dispositivo que tem hover de
              verdade. */}
          <span className="max-w-0 overflow-hidden text-sm whitespace-nowrap opacity-0 transition-all duration-300 ease-out [@media(hover:hover)]:group-hover/button:max-w-40 [@media(hover:hover)]:group-hover/button:opacity-100">
            Chamar suporte
          </span>
        </Button>
      )}

      <Dialog open={session?.status === "pending" && session.initiatedBy === "admin"}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Suporte BaseERP quer ver sua tela</DialogTitle>
            <DialogDescription>
              Alguém do suporte quer acompanhar o que você está fazendo no sistema, ao vivo, para te
              ajudar. Você pode encerrar quando quiser, e controle remoto só acontece se você
              permitir depois, separadamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDecline} disabled={isPending}>
              Recusar
            </Button>
            <Button onClick={handleApprove} disabled={isPending}>
              Permitir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {session?.status === "pending" && session.initiatedBy === "user" && (
        <div className="bg-card fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-lg border p-3 text-sm shadow-lg">
          <span>Aguardando atendimento do suporte...</span>
          <Button variant="ghost" size="sm" onClick={handleEnd}>
            Cancelar
          </Button>
        </div>
      )}

      {session?.status === "active" && (
        <div className="flex items-center justify-between gap-4 bg-blue-600 px-4 py-2 text-sm font-medium text-white">
          <span className="flex items-center gap-2">
            <Headset className="h-4 w-4" />
            Sessão de suporte ativa — sua tela está sendo acompanhada ao vivo
          </span>
          {/* Controles num "pill" claro em vez de cor forçada em cima do
              cada componente: assim o Switch e o Button usam as próprias
              cores padrão (pensadas pra fundo claro), sem risco de texto
              claro em cima de fundo claro. Fundo com leve tom azulado (em
              vez de branco puro) pra não virar um bloco branco liso sem
              destaque nenhum sobre a barra — e "Encerrar" com o estilo
              destrutivo (fundo vermelho suave), pra se destacar como uma
              ação diferente do toggle, não só mais um botão neutro. */}
          <div className="flex shrink-0 items-center gap-3 rounded-full bg-blue-50 px-3 py-1 shadow-sm">
            <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
              Controle remoto
              <Switch
                checked={session.controlGranted}
                onCheckedChange={handleToggleControl}
                disabled={isPending}
                // O cinza claro padrão do estado "desligado" (pensado pra
                // ficar sobre fundo branco comum) quase some em cima do
                // pill azul clarinho daqui — escurecido só nesta
                // instância.
                className="data-unchecked:bg-zinc-400"
              />
            </label>
            <div className="h-4 w-px bg-blue-200" />
            <Button variant="destructive" size="sm" onClick={handleEnd} disabled={isPending}>
              <X className="h-4 w-4" />
              Encerrar
            </Button>
          </div>
        </div>
      )}

      {session?.status === "active" && session.controlGranted && (
        <div
          ref={cursorRef}
          className="pointer-events-none fixed top-0 left-0 z-[60] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-500 bg-red-500/30"
        />
      )}
    </>
  );
}

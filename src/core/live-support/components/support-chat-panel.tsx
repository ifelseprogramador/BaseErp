"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, MessageSquare, Volume2, VolumeX, X } from "lucide-react";
import type { ChatMessageDto } from "../actions";
import { SUPPORT_CHAT_EVENT } from "../chat-events";
import { flashTabTitle, playChatSound, setSoundEnabled, useSoundEnabled } from "../chat-sound";
import { DraggablePanel } from "./draggable-panel";
import { SupportChat } from "./support-chat";

/**
 * Painel da conversa do suporte, igual para os dois lados: caixa flutuante
 * ARRASTÁVEL, que recolhe, com aviso sonoro (e título da aba piscando em
 * segundo plano) quando chega mensagem do outro lado, botão de silenciar e
 * contador de não lidas enquanto está recolhida. Fica montada durante toda
 * a sessão ativa — por isso ouve o evento do tempo real mesmo recolhida, e o
 * `SupportChat` (lista + campo) só existe com o painel aberto.
 */
export function SupportChatPanel({
  sessionId,
  side,
  className,
  onEnd,
}: {
  sessionId: string;
  side: "admin" | "user";
  className?: string;
  /** Mostra "encerrar conversa" no cabeçalho (conversa só por texto, em que não
   * há a barra da sessão de tela para encerrar). */
  onEnd?: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [unread, setUnread] = useState(0);
  const soundEnabled = useSoundEnabled();
  const notified = useRef<Set<string>>(new Set());
  const openRef = useRef(open);
  const soundRef = useRef(soundEnabled);

  useEffect(() => {
    openRef.current = open;
    soundRef.current = soundEnabled;
  }, [open, soundEnabled]);

  // Uma mensagem avisa uma vez só, venha pelo tempo real ou pela releitura.
  const notify = useCallback(
    (message: ChatMessageDto) => {
      if (message.role === side || notified.current.has(message.id)) return;
      notified.current.add(message.id);
      if (soundRef.current) playChatSound();
      flashTabTitle("💬 Nova mensagem — suporte");
      if (!openRef.current) setUnread((n) => n + 1);
    },
    [side],
  );

  useEffect(() => {
    function onMessage(event: Event) {
      const detail = (event as CustomEvent<{ sessionId: string; message: ChatMessageDto }>).detail;
      if (detail.sessionId === sessionId) notify(detail.message);
    }
    window.addEventListener(SUPPORT_CHAT_EVENT, onMessage);
    return () => window.removeEventListener(SUPPORT_CHAT_EVENT, onMessage);
  }, [sessionId, notify]);

  function toggleOpen() {
    setOpen((value) => !value);
    setUnread(0);
  }

  return (
    <DraggablePanel
      collapsed={!open}
      className={
        className ??
        "bg-card fixed right-4 bottom-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-lg border p-3 shadow-lg"
      }
      header={
        <div className="flex items-center justify-between gap-2 text-sm font-medium">
          <span className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {side === "user" ? "Conversa com o suporte" : "Conversa com o cliente"}
            {unread > 0 && (
              <span
                className="bg-destructive rounded-full px-1.5 text-[10px] leading-4 font-semibold text-white"
                aria-label={`${unread} mensagens não lidas`}
              >
                {unread}
              </span>
            )}
          </span>
          <span className="flex items-center gap-0.5">
            <button
              type="button"
              data-no-drag
              onClick={() => setSoundEnabled(!soundEnabled)}
              aria-pressed={soundEnabled}
              aria-label={soundEnabled ? "Silenciar aviso sonoro" : "Ativar aviso sonoro"}
              title={soundEnabled ? "Silenciar aviso sonoro" : "Ativar aviso sonoro"}
              className="hover:bg-muted rounded p-0.5"
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            {onEnd && (
              <button
                type="button"
                data-no-drag
                onClick={onEnd}
                aria-label="Encerrar conversa"
                title="Encerrar conversa"
                className="hover:bg-muted rounded p-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              data-no-drag
              onClick={toggleOpen}
              aria-expanded={open}
              aria-label={open ? "Recolher conversa" : "Expandir conversa"}
              className="hover:bg-muted rounded p-0.5"
            >
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          </span>
        </div>
      }
    >
      {open && <SupportChat sessionId={sessionId} side={side} onIncoming={notify} />}
    </DraggablePanel>
  );
}

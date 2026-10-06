"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { listSupportMessages, sendSupportMessage, type ChatMessageDto } from "../actions";
import { SUPPORT_CHAT_EVENT } from "../chat-events";
import { MAX_CHAT_MESSAGE_LENGTH } from "../wait";

/** Mescla preservando ordem de chegada e sem duplicar (broadcast + releitura). */
function mergeMessages(current: ChatMessageDto[], incoming: ChatMessageDto[]): ChatMessageDto[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Conversa de texto da sessão de suporte (tipo o chat do TeamViewer), usada
 * dos dois lados. `side` só define qual lado é "eu": no do usuário as
 * mensagens do suporte aparecem como "Suporte"; no do admin, as do usuário
 * aparecem como "Cliente". O histórico vem do banco (sobrevive a recarregar);
 * o tempo real chega pelo evento da janela (ver `chat-events.ts`) e uma
 * releitura a cada 10 s cobre qualquer broadcast perdido.
 */
export function SupportChat({
  sessionId,
  side,
  className,
}: {
  sessionId: string;
  side: "admin" | "user";
  className?: string;
}) {
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement | null>(null);

  const reload = useCallback(async () => {
    const result = await listSupportMessages(sessionId);
    if (result.ok && result.messages) {
      setMessages((prev) => mergeMessages(prev, result.messages ?? []));
    }
  }, [sessionId]);

  useEffect(() => {
    // Adiado (não síncrono): a primeira leitura grava estado, e `setState`
    // direto no corpo do effect re-renderiza em cascata.
    const first = setTimeout(() => void reload(), 0);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, 10_000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [reload]);

  useEffect(() => {
    function onMessage(event: Event) {
      const detail = (event as CustomEvent<{ sessionId: string; message: ChatMessageDto }>).detail;
      if (detail.sessionId !== sessionId) return;
      setMessages((prev) => mergeMessages(prev, [detail.message]));
    }
    window.addEventListener(SUPPORT_CHAT_EVENT, onMessage);
    return () => window.removeEventListener(SUPPORT_CHAT_EVENT, onMessage);
  }, [sessionId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    startTransition(async () => {
      const result = await sendSupportMessage(sessionId, body);
      if (result.ok && result.chatMessage) {
        setDraft("");
        setMessages((prev) => mergeMessages(prev, [result.chatMessage as ChatMessageDto]));
      } else {
        toast.error(result.message ?? "Não foi possível enviar a mensagem.");
      }
    });
  }

  const otherLabel = side === "user" ? "Suporte" : "Cliente";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        ref={listRef}
        className="bg-muted/40 flex h-48 flex-col gap-1.5 overflow-y-auto rounded-md border p-2 text-sm"
      >
        {messages.length === 0 ? (
          <p className="text-muted-foreground m-auto flex items-center gap-1.5 text-xs">
            <MessageSquare className="h-3.5 w-3.5" />
            Escreva aqui para conversar durante o atendimento.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.role === side;
            return (
              <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                <span className="text-muted-foreground text-[10px]">
                  {mine ? "Você" : otherLabel}
                </span>
                <span
                  className={cn(
                    "max-w-[85%] rounded-lg px-2.5 py-1.5 break-words whitespace-pre-wrap",
                    mine ? "bg-primary text-primary-foreground" : "bg-background border",
                  )}
                >
                  {m.body}
                </span>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={handleSend} className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Digite uma mensagem..."
          maxLength={MAX_CHAT_MESSAGE_LENGTH}
          autoComplete="off"
          aria-label="Mensagem para o atendimento"
        />
        <Button type="submit" size="icon" disabled={isPending || !draft.trim()} aria-label="Enviar">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

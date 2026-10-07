"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Headset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "./collapsible-card";
import { requestSupportAccess } from "@/core/live-support/actions";
import { LiveSessionViewer } from "@/core/live-support/components/live-session-viewer";

interface OpenSession {
  id: string;
  status: "pending" | "active" | "chat";
  screenRequested?: boolean;
  controlGranted: boolean;
}

interface SupportTarget {
  userId: string;
  name: string;
  role: "owner" | "staff";
}

export function LiveSupportCard({
  organizationId,
  targets,
  initialSession,
}: {
  organizationId: string;
  /** Pessoas ativas da organização; o suporte pede acesso à tela de UMA. */
  targets: SupportTarget[];
  initialSession: OpenSession | null;
}) {
  const [session, setSession] = useState(initialSession);
  const [targetId, setTargetId] = useState(targets[0]?.userId ?? "");
  const [isPending, startTransition] = useTransition();

  function handleRequest() {
    startTransition(async () => {
      const result = await requestSupportAccess(organizationId, targetId);
      if (result.ok && result.sessionId) {
        setSession({ id: result.sessionId, status: "pending", controlGranted: false });
      } else {
        toast.error(result.message ?? "Não foi possível solicitar acesso.");
      }
    });
  }

  return (
    // Aberto quando já há uma sessão em andamento (pedido, conversa ou tela).
    <CollapsibleCard title="Suporte ao vivo" defaultOpen={initialSession !== null}>
      {!session ? (
        <div className="flex flex-wrap items-center gap-2">
          {targets.length > 1 && (
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              aria-label="Pessoa cuja tela será acompanhada"
              className="border-input h-8 rounded-lg border bg-transparent px-2.5 text-sm"
            >
              {targets.map((t) => (
                <option key={t.userId} value={t.userId}>
                  {t.name}
                  {t.role === "owner" ? " (responsável)" : ""}
                </option>
              ))}
            </select>
          )}
          <Button variant="outline" onClick={handleRequest} disabled={isPending || !targetId}>
            <Headset className="h-4 w-4" />
            {isPending ? "Solicitando..." : "Solicitar acesso à tela"}
          </Button>
        </div>
      ) : (
        <LiveSessionViewer
          sessionId={session.id}
          initialStatus={session.status}
          initialScreenRequested={session.screenRequested}
          initialControlGranted={session.controlGranted}
          onEnded={() => setSession(null)}
        />
      )}
    </CollapsibleCard>
  );
}

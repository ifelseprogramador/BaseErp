"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Headset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requestSupportAccess } from "@/core/live-support/actions";
import { LiveSessionViewer } from "@/core/live-support/components/live-session-viewer";

interface OpenSession {
  id: string;
  status: "pending" | "active";
  controlGranted: boolean;
}

export function LiveSupportCard({
  organizationId,
  initialSession,
}: {
  organizationId: string;
  initialSession: OpenSession | null;
}) {
  const [session, setSession] = useState(initialSession);
  const [isPending, startTransition] = useTransition();

  function handleRequest() {
    startTransition(async () => {
      const result = await requestSupportAccess(organizationId);
      if (result.ok && result.sessionId) {
        setSession({ id: result.sessionId, status: "pending", controlGranted: false });
      } else {
        toast.error(result.message ?? "Não foi possível solicitar acesso.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Suporte ao vivo</CardTitle>
      </CardHeader>
      <CardContent>
        {!session ? (
          <Button variant="outline" onClick={handleRequest} disabled={isPending}>
            <Headset className="h-4 w-4" />
            {isPending ? "Solicitando..." : "Solicitar acesso à tela"}
          </Button>
        ) : (
          <LiveSessionViewer
            sessionId={session.id}
            initialStatus={session.status}
            initialControlGranted={session.controlGranted}
            onEnded={() => setSession(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/core/format";
import { clearAuditLogForOrg, deleteAuditLogEntry } from "../actions";

const ACTION_LABELS: Record<string, string> = {
  "organizacao.criar": "Organização criada",
  "organizacao.bloquear": "Organização bloqueada",
  "organizacao.desbloquear": "Organização desbloqueada",
  "organizacao.cobranca": "Cobrança atualizada",
  "organizacao.modulo": "Módulo alterado",
  "organizacao.apagar_tudo": "Todos os dados apagados",
  "impersonation.iniciar": "Entrou em modo suporte",
  "impersonation.encerrar": "Saiu do modo suporte",
  "live_support.solicitar": "Solicitou sessão de suporte ao vivo",
  "live_support.chamar": "Organização chamou o suporte",
  "live_support.aceitar": "Sessão de suporte aceita",
  "live_support.aprovar": "Organização aprovou a sessão de suporte",
  "live_support.recusar": "Sessão de suporte recusada",
  "live_support.encerrar": "Sessão de suporte encerrada",
  "live_support.conceder_controle": "Controle remoto concedido",
  "live_support.revogar_controle": "Controle remoto revogado",
};

interface AuditEntry {
  id: string;
  actorEmail: string;
  action: string;
  metadata: unknown;
  createdAt: Date;
}

export function AuditLogCard({
  organizationId,
  entries: initialEntries,
}: {
  organizationId: string;
  entries: AuditEntry[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [isPending, startTransition] = useTransition();
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  function handleDeleteEntry(entryId: string) {
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    startTransition(async () => {
      const result = await deleteAuditLogEntry(entryId, organizationId);
      if (!result.ok) {
        toast.error(result.message ?? "Não foi possível apagar.");
      }
    });
  }

  function handleClearAll() {
    setEntries([]);
    setClearDialogOpen(false);
    startTransition(async () => {
      const result = await clearAuditLogForOrg(organizationId);
      if (result.ok) {
        toast.success("Histórico limpo.");
      } else {
        toast.error(result.message ?? "Não foi possível limpar o histórico.");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Histórico (auditoria)</CardTitle>
        {entries.length > 0 && (
          <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
            <DialogTrigger render={<Button variant="outline" size="sm" />} disabled={isPending}>
              <Trash2 className="h-4 w-4" />
              Limpar tudo
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Limpar histórico</DialogTitle>
                <DialogDescription>
                  Apaga todas as {entries.length} entradas do histórico desta organização. Não afeta
                  os dados dela, só o registro de auditoria. Não tem volta.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleClearAll}>
                  Limpar tudo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma ação registrada ainda.</p>
        ) : (
          <ul className="flex max-h-80 flex-col gap-3 overflow-y-auto pr-1 text-sm">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{ACTION_LABELS[entry.action] ?? entry.action}</p>
                  <p className="text-muted-foreground text-xs">{entry.actorEmail}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-muted-foreground text-xs">
                    {formatDateTime(entry.createdAt)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Apagar entrada"
                    disabled={isPending}
                    onClick={() => handleDeleteEntry(entry.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

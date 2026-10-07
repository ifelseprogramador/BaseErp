"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { describeDevice, formatLocation, isPrivateIp } from "@/core/login-info";
import { clearLoginEvents, deleteLoginEvent } from "../actions";
import { CollapsibleCard } from "./collapsible-card";

export interface LoginEntry {
  id: string;
  email: string | null;
  organizationName: string | null;
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  userAgent: string | null;
  createdAt: Date;
}

/** Data e hora EXATAS (com segundos), no fuso de Brasília. */
export function formatExactDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function locationLabel(entry: LoginEntry): string {
  return formatLocation(entry) ?? (isPrivateIp(entry.ip) ? "Rede local" : "Não identificada");
}

export function LoginHistoryCard({ entries: initialEntries }: { entries: LoginEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [isPending, startTransition] = useTransition();
  const [clearOpen, setClearOpen] = useState(false);

  function handleDelete(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    startTransition(async () => {
      const result = await deleteLoginEvent(id);
      if (!result.ok) toast.error(result.message ?? "Não foi possível apagar.");
    });
  }

  function handleClearAll() {
    setEntries([]);
    setClearOpen(false);
    startTransition(async () => {
      const result = await clearLoginEvents();
      if (result.ok) toast.success("Histórico de acessos limpo.");
      else toast.error(result.message ?? "Não foi possível limpar o histórico.");
    });
  }

  return (
    <CollapsibleCard
      title="Histórico de acessos"
      actions={
        entries.length > 0 && (
          <Dialog open={clearOpen} onOpenChange={setClearOpen}>
            <DialogTrigger render={<Button variant="outline" size="sm" />} disabled={isPending}>
              <Trash2 className="h-4 w-4" />
              Limpar tudo
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Limpar histórico de acessos</DialogTitle>
                <DialogDescription>
                  Apaga os {entries.length} registros de acesso exibidos (e todos os demais). Não
                  afeta contas nem dados de ninguém. Não tem volta.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setClearOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleClearAll}>
                  Limpar tudo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      }
    >
      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum acesso registrado ainda.</p>
      ) : (
        <ul className="flex max-h-96 flex-col gap-3 overflow-y-auto pr-1 text-sm">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{entry.email ?? "(sem e-mail)"}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {entry.organizationName ?? "Sem organização"}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatExactDateTime(entry.createdAt)} · IP{" "}
                  <span className="font-mono">{entry.ip ?? "desconhecido"}</span>
                </p>
                <p className="text-muted-foreground text-xs" title={entry.userAgent ?? undefined}>
                  {locationLabel(entry)} · {describeDevice(entry.userAgent)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Apagar registro de acesso"
                disabled={isPending}
                onClick={() => handleDelete(entry.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </CollapsibleCard>
  );
}

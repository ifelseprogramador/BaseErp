"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSupportWaitSeconds } from "@/core/live-support/actions";
import { MAX_SUPPORT_WAIT_SECONDS, MIN_SUPPORT_WAIT_SECONDS } from "@/core/live-support/wait";

/** Quanto os usuários desta organização esperam por atendimento ao chamar o
 * suporte (com você online) antes de o pedido virar "sem atendimento" e o
 * Telegram avisar. Por organização, não global. */
export function OrgSupportWaitForm({
  organizationId,
  initialSeconds,
}: {
  organizationId: string;
  initialSeconds: number;
}) {
  const [seconds, setSeconds] = useState(String(initialSeconds));
  const [isPending, startTransition] = useTransition();

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(seconds);
    if (
      !Number.isFinite(value) ||
      value < MIN_SUPPORT_WAIT_SECONDS ||
      value > MAX_SUPPORT_WAIT_SECONDS
    ) {
      toast.error(
        `Informe entre ${MIN_SUPPORT_WAIT_SECONDS} e ${MAX_SUPPORT_WAIT_SECONDS} segundos.`,
      );
      return;
    }
    startTransition(async () => {
      const result = await updateSupportWaitSeconds(organizationId, value);
      if (result.ok) toast.success("Tempo de espera salvo.");
      else toast.error(result.message ?? "Não foi possível salvar.");
    });
  }

  return (
    <form data-unsaved-guard onSubmit={handleSave} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="orgSupportWait">Espera por atendimento (segundos)</Label>
          <Input
            id="orgSupportWait"
            type="number"
            min={MIN_SUPPORT_WAIT_SECONDS}
            max={MAX_SUPPORT_WAIT_SECONDS}
            value={seconds}
            onChange={(e) => setSeconds(e.target.value)}
            className="w-32"
          />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Quando alguém desta empresa clica em &quot;Chamar suporte&quot; com você online, espera esse
        tempo por um atendimento. Sem ninguém online (ou passado o tempo), você recebe o aviso no
        Telegram.
      </p>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendTelegramTest, updateSupportWaitSeconds } from "@/core/live-support/actions";
import { MAX_SUPPORT_WAIT_SECONDS, MIN_SUPPORT_WAIT_SECONDS } from "@/core/live-support/wait";

/** Quanto o usuário espera por atendimento antes de o pedido virar "sem
 * atendimento" (e o Telegram avisar). Configuração global da plataforma. */
export function SupportSettingsCard({
  initialSeconds,
  telegramConfigured,
}: {
  initialSeconds: number;
  telegramConfigured: boolean;
}) {
  const [seconds, setSeconds] = useState(String(initialSeconds));
  const [isPending, startTransition] = useTransition();
  const [isTesting, startTesting] = useTransition();

  function handleTelegramTest() {
    startTesting(async () => {
      const result = await sendTelegramTest();
      if (result.ok) toast.success("Mensagem de teste enviada. Confira o Telegram.");
      else toast.error(result.message ?? "Não foi possível enviar o teste.");
    });
  }

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
      const result = await updateSupportWaitSeconds(value);
      if (result.ok) toast.success("Tempo de espera salvo.");
      else toast.error(result.message ?? "Não foi possível salvar.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atendimento de suporte</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <form onSubmit={handleSave} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="supportWait">Tempo de espera do usuário (segundos)</Label>
            <Input
              id="supportWait"
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
        </form>
        <p className="text-muted-foreground text-xs">
          Quando alguém clica em &quot;Chamar suporte&quot; com você online, espera esse tempo por
          um atendimento. Sem ninguém online (ou passado o tempo), o pedido fica aqui e você é
          avisado pelo Telegram.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTelegramTest}
            disabled={isTesting || !telegramConfigured}
          >
            {isTesting ? "Enviando..." : "Enviar mensagem de teste"}
          </Button>
        </div>
        <p className={telegramConfigured ? "text-xs text-emerald-600" : "text-destructive text-xs"}>
          {telegramConfigured
            ? "Telegram configurado."
            : "Telegram NÃO configurado: defina TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID nas variáveis de ambiente para receber os avisos."}
        </p>
      </CardContent>
    </Card>
  );
}

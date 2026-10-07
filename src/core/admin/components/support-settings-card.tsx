"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getTelegramWebhookStatus,
  registerTelegramWebhook,
  sendTelegramTest,
  type TelegramWebhookStatus,
} from "@/core/live-support/actions";

/**
 * Telegram do atendimento: avisos de pedido sem atendimento e respostas pelo
 * Telegram. O tempo de espera NÃO fica aqui — é por organização (na ficha de
 * cada uma). Os segredos vêm de variáveis de ambiente; este card só testa e
 * registra o que elas configuram.
 */
export function SupportSettingsCard({
  telegramConfigured,
  webhookSecretConfigured,
}: {
  telegramConfigured: boolean;
  webhookSecretConfigured: boolean;
}) {
  const [isTesting, startTesting] = useTransition();
  const [isRegistering, startRegistering] = useTransition();
  const [isChecking, startChecking] = useTransition();
  const [status, setStatus] = useState<TelegramWebhookStatus | null>(null);

  function handleTest() {
    startTesting(async () => {
      const result = await sendTelegramTest();
      if (result.ok) toast.success("Mensagem de teste enviada. Confira o Telegram.");
      else toast.error(result.message ?? "Não foi possível enviar o teste.");
    });
  }

  function handleRegister() {
    startRegistering(async () => {
      const result = await registerTelegramWebhook();
      if (result.ok) {
        toast.success("Respostas pelo Telegram ativadas.");
        setStatus(await getTelegramWebhookStatus());
      } else {
        toast.error(result.message ?? "Não foi possível registrar.");
      }
    });
  }

  function handleCheck() {
    startChecking(async () => setStatus(await getTelegramWebhookStatus()));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Telegram do atendimento</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-muted-foreground text-xs">
          Quando alguém chama o suporte e você não está com este painel aberto (ou o tempo de espera
          da empresa acaba), o aviso chega no Telegram. Se você <strong>responder</strong> a
          mensagem lá, a resposta aparece na caixa de conversa da pessoa; quando ela liberar a tela,
          a conversa continua aqui no painel. O tempo de espera de cada empresa fica na ficha dela.
        </p>

        <p className={telegramConfigured ? "text-xs text-emerald-600" : "text-destructive text-xs"}>
          {telegramConfigured
            ? "Avisos configurados (token e chat id)."
            : "Avisos NÃO configurados: defina TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID nas variáveis de ambiente."}
        </p>
        <p
          className={
            webhookSecretConfigured ? "text-xs text-emerald-600" : "text-muted-foreground text-xs"
          }
        >
          {webhookSecretConfigured
            ? "Segredo das respostas definido (TELEGRAM_WEBHOOK_SECRET)."
            : "Para responder pelo Telegram, defina também TELEGRAM_WEBHOOK_SECRET (uma senha longa e aleatória)."}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={isTesting || !telegramConfigured}
          >
            {isTesting ? "Enviando..." : "Enviar mensagem de teste"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRegister}
            disabled={isRegistering || !telegramConfigured || !webhookSecretConfigured}
          >
            {isRegistering ? "Registrando..." : "Ativar respostas pelo Telegram"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCheck}
            disabled={isChecking || !telegramConfigured}
          >
            {isChecking ? "Consultando..." : "Verificar situação"}
          </Button>
        </div>

        {status && (
          <p
            className={
              status.ok && status.matchesThisSite
                ? "text-xs text-emerald-600"
                : "text-muted-foreground text-xs"
            }
          >
            {!status.ok
              ? status.message
              : !status.url
                ? "Respostas pelo Telegram: NÃO ativadas (nenhum endereço registrado)."
                : status.matchesThisSite
                  ? `Respostas pelo Telegram ativas neste sistema.${
                      status.lastErrorMessage
                        ? ` Último erro do Telegram: ${status.lastErrorMessage}`
                        : ""
                    }`
                  : `O bot está apontado para outro endereço (${status.url}). Clique em "Ativar respostas pelo Telegram" para apontar para este sistema.`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hint } from "@/components/hint";
import type { ActionResult } from "@/core/action-result";
import { removeEmailSettings, saveEmailSettings, testEmailSettings } from "../actions";

const initialState: ActionResult = { ok: false };

export interface EmailSettingsSummary {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromName: string | null;
  fromEmail: string;
}

/** Configuração OPCIONAL (avançada) de e-mail SMTP: sem ela, o botão de envio usa WhatsApp/link/app de e-mail. */
export function EmailSettingsForm({ summary }: { summary: EmailSettingsSummary | null }) {
  const [state, formAction, isPending] = useActionState(saveEmailSettings, initialState);
  const errors = state.errors ?? {};
  const [v, setV] = useState({
    host: summary?.host ?? "",
    port: String(summary?.port ?? 587),
    secure: summary?.secure ?? false,
    username: summary?.username ?? "",
    fromName: summary?.fromName ?? "",
    fromEmail: summary?.fromEmail ?? "",
  });
  const [busy, startBusy] = useTransition();
  const set = (k: keyof typeof v, val: string | boolean) => setV((s) => ({ ...s, [k]: val }));

  useEffect(() => {
    if (state.ok) toast.success("Configuração de e-mail salva.");
    else if (state.message) toast.error(state.message);
  }, [state]);

  const field = (id: keyof typeof v, label: string, hint?: string, type = "text") => (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        {hint && <Hint>{hint}</Hint>}
      </div>
      <Input
        id={id}
        name={id}
        type={type}
        value={String(v[id])}
        onChange={(e) => set(id, e.target.value)}
        aria-invalid={!!errors[id]}
      />
      {errors[id]?.map((e) => (
        <p key={e} className="text-destructive text-sm">
          {e}
        </p>
      ))}
    </div>
  );

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {field(
        "host",
        "Servidor SMTP",
        "Ex.: smtp.gmail.com, smtp.office365.com ou o servidor do seu provedor.",
      )}
      {field(
        "port",
        "Porta",
        "587 (STARTTLS) é o mais comum; 465 usa conexão segura direta.",
        "number",
      )}
      {field("username", "Usuário", "Normalmente o seu e-mail completo.")}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="password">Senha</Label>
          <Hint>
            Use uma senha de aplicativo (Gmail e Outlook exigem). Fica guardada criptografada e
            nunca é exibida de novo. Deixe em branco para manter a atual.
          </Hint>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder={summary ? "•••••••• (salva)" : ""}
          aria-invalid={!!errors.password}
        />
        {errors.password?.map((e) => (
          <p key={e} className="text-destructive text-sm">
            {e}
          </p>
        ))}
      </div>
      {field(
        "fromName",
        "Nome do remetente",
        "Como o cliente vê o remetente. Ex.: nome da sua empresa.",
      )}
      {field(
        "fromEmail",
        "E-mail do remetente",
        "Precisa ser um e-mail que o servidor aceita enviar.",
        "email",
      )}
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="secure"
          checked={v.secure}
          onChange={(e) => set("secure", e.target.checked)}
        />
        Conexão segura direta (SSL) — marque só para a porta 465
      </label>

      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
        {summary && (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                startBusy(async () => {
                  const r = await testEmailSettings();
                  if (r.ok) toast.success(r.message);
                  else toast.error(r.message);
                })
              }
            >
              Testar conexão
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() =>
                startBusy(async () => {
                  const r = await removeEmailSettings();
                  if (r.ok) toast.success("Configuração removida.");
                  else toast.error(r.message);
                })
              }
            >
              Remover
            </Button>
          </>
        )}
      </div>
    </form>
  );
}

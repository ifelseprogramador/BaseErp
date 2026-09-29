"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/core/action-result";

const initialState: ActionResult = { ok: false };

/**
 * Reaproveitado em duas telas: `/trocar-senha-obrigatoria` (action
 * redireciona para `/` ao final — `showSuccessToast` fica `false`,
 * porque a navegação já é o próprio feedback) e `/perfil` (action só
 * devolve `{ ok: true }`, mostramos um toast).
 */
export function ChangePasswordForm({
  action,
  submitLabel = "Trocar senha",
  showSuccessToast = true,
}: {
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
  submitLabel?: string;
  showSuccessToast?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const errors = state.errors ?? {};
  // Campos controlados de propósito: o React reseta campo não
  // controlado de formulário assim que a action termina de processar,
  // mesmo em erro (ver login-form.tsx) — sem isso, um erro de validação
  // (ex.: senhas não coincidem) apagava as duas senhas, obrigando a
  // digitar tudo de novo.
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (state.ok) {
      if (showSuccessToast) toast.success("Senha atualizada.");
      // Aqui sim limpa — depois de salvar com sucesso, não faz sentido
      // deixar a senha nova visível na tela. Reagindo a `state.ok` (o
      // resultado da Server Action, um sistema externo) mudar, não
      // espelhando render — mesmo caso citado na doc do React como uso
      // válido de efeito.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPassword("");
      setConfirmPassword("");
    }
  }, [state, showSuccessToast]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Nova senha</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {errors.password?.map((e) => (
          <p key={e} className="text-destructive text-sm">
            {e}
          </p>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword">Confirme a nova senha</Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          minLength={6}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {errors.confirmPassword?.map((e) => (
          <p key={e} className="text-destructive text-sm">
            {e}
          </p>
        ))}
      </div>
      {state.message && <p className="text-destructive text-sm">{state.message}</p>}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

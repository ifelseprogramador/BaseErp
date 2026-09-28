"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  useEffect(() => {
    if (state.ok && showSuccessToast) toast.success("Senha atualizada.");
  }, [state, showSuccessToast]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Nova senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
        />
        {errors.password?.map((e) => (
          <p key={e} className="text-destructive text-sm">
            {e}
          </p>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword">Confirme a nova senha</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
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

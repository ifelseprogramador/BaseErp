"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/core/action-result";
import { updateDisplayName } from "../actions";

const initialState: ActionResult = { ok: false };

export function DisplayNameForm({ initialDisplayName }: { initialDisplayName: string }) {
  const [state, formAction, isPending] = useActionState(updateDisplayName, initialState);
  const errors = state.errors ?? {};

  useEffect(() => {
    if (state.ok) toast.success("Nome atualizado.");
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName">Nome de exibição</Label>
        {/* `key`: sem isso, o input (não controlado) não reflete um
            `defaultValue` novo depois que o server revalida — ficaria
            preso no valor de quando montou pela primeira vez. */}
        <Input
          key={initialDisplayName}
          id="displayName"
          name="displayName"
          defaultValue={initialDisplayName}
          required
          maxLength={120}
        />
        {errors.displayName?.map((e) => (
          <p key={e} className="text-destructive text-sm">
            {e}
          </p>
        ))}
      </div>
      {state.message && <p className="text-destructive text-sm">{state.message}</p>}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar nome"}
        </Button>
      </div>
    </form>
  );
}

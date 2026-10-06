"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/core/action-result";

const initialState: ActionResult = { ok: false };

/**
 * Libera o modo multiusuário de uma organização e define o limite de
 * pessoas ativas — só o dono da plataforma vê isto (`/admin`). O dono da
 * conta convida dentro do limite em `/equipe`.
 */
export function SeatsForm({
  multiUser,
  seatLimit,
  extraSeatPriceCents,
  activeCount,
  action,
}: {
  multiUser: boolean;
  seatLimit: number;
  extraSeatPriceCents: number | null;
  activeCount: number;
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [enabled, setEnabled] = useState(multiUser);
  const errors = state.errors ?? {};

  useEffect(() => {
    if (state.ok) toast.success("Usuários atualizados.");
    else if (state.message) toast.error(state.message);
  }, [state]);

  const priceDefault =
    extraSeatPriceCents === null ? "" : (extraSeatPriceCents / 100).toFixed(2).replace(".", ",");

  return (
    <form
      key={`${multiUser}-${seatLimit}-${extraSeatPriceCents}`}
      action={formAction}
      className="flex flex-col gap-4"
    >
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="multiUser"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          <span className="font-medium">Permitir vários usuários</span>
          <span className="text-muted-foreground block">
            Desligado: só o responsável acessa (1 usuário). Ligado: ele convida a equipe e escolhe
            os módulos de cada pessoa.
          </span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="seatLimit">Limite de usuários ativos</Label>
          <Input
            id="seatLimit"
            name="seatLimit"
            type="number"
            min={1}
            max={500}
            defaultValue={seatLimit}
            disabled={!enabled}
            aria-invalid={!!errors.seatLimit}
          />
          {errors.seatLimit?.map((e) => (
            <p key={e} className="text-destructive text-sm">
              {e}
            </p>
          ))}
          <p className="text-muted-foreground text-xs">Em uso agora: {activeCount}.</p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="extraSeatPrice">Valor por usuário extra (R$, opcional)</Label>
          <Input
            id="extraSeatPrice"
            name="extraSeatPrice"
            inputMode="decimal"
            placeholder="29,90"
            defaultValue={priceDefault}
            aria-invalid={!!errors.extraSeatPriceCents}
          />
          {errors.extraSeatPriceCents?.map((e) => (
            <p key={e} className="text-destructive text-sm">
              {e}
            </p>
          ))}
          <p className="text-muted-foreground text-xs">
            Só um lembrete do combinado — nenhuma cobrança é automática.
          </p>
        </div>
      </div>

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Salvando..." : "Salvar usuários"}
      </Button>
    </form>
  );
}

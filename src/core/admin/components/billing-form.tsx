"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionResult } from "@/core/action-result";

const initialState: ActionResult = { ok: false };

const BILLING_LABELS: Record<string, string> = {
  em_dia: "Em dia",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

export function BillingForm({
  billingStatus,
  nextDueDate,
  billingNotes,
  action,
}: {
  billingStatus: string;
  nextDueDate: string | null;
  billingNotes: string | null;
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.ok) toast.success("Cobrança atualizada.");
  }, [state]);

  return (
    // Remonta com dado fresco depois de salvar, para o Select não avisar
    // de defaultValue mudando após montado.
    <form
      key={`${billingStatus}-${nextDueDate}-${billingNotes}`}
      action={formAction}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="billingStatus">Status da cobrança</Label>
        <Select name="billingStatus" items={BILLING_LABELS} defaultValue={billingStatus}>
          <SelectTrigger id="billingStatus" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(BILLING_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="nextDueDate">Próximo vencimento</Label>
        <Input id="nextDueDate" name="nextDueDate" type="date" defaultValue={nextDueDate ?? ""} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="billingNotes">Observações</Label>
        <Textarea
          id="billingNotes"
          name="billingNotes"
          defaultValue={billingNotes ?? ""}
          rows={3}
        />
      </div>

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Salvando..." : "Salvar cobrança"}
      </Button>
    </form>
  );
}

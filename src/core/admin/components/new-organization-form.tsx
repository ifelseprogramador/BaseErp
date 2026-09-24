"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ActionResult } from "@/core/action-result";
import { createOrganization } from "../actions";

const initialState: ActionResult = { ok: false };

export function NewOrganizationForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createOrganization, initialState);
  const errors = state.errors ?? {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Nova organização</DialogTrigger>
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Nova organização</DialogTitle>
            <DialogDescription>
              Cria a organização e o usuário dono já confirmado (sem precisar de e-mail).
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="organizationName">Nome da organização</Label>
            <Input id="organizationName" name="organizationName" required />
            {errors.organizationName?.map((e) => (
              <p key={e} className="text-destructive text-sm">
                {e}
              </p>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="businessType">Ramo de negócio (opcional)</Label>
            <Input
              id="businessType"
              name="businessType"
              placeholder="ex.: bordados, oficina mecânica..."
            />
            {errors.businessType?.map((e) => (
              <p key={e} className="text-destructive text-sm">
                {e}
              </p>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ownerEmail">E-mail do dono</Label>
            <Input id="ownerEmail" name="ownerEmail" type="email" required />
            {errors.ownerEmail?.map((e) => (
              <p key={e} className="text-destructive text-sm">
                {e}
              </p>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ownerPassword">Senha inicial</Label>
            <Input id="ownerPassword" name="ownerPassword" type="text" required minLength={6} />
            {errors.ownerPassword?.map((e) => (
              <p key={e} className="text-destructive text-sm">
                {e}
              </p>
            ))}
          </div>

          {state.message && <p className="text-destructive text-sm">{state.message}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Criando..." : "Criar organização"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

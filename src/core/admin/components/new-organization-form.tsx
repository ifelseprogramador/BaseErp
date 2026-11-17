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
import type { BusinessTypePreset } from "@/core/business-type-presets";
import { createOrganization } from "../actions";

const initialState: ActionResult = { ok: false };

/** `businessTypePresets` vem de `core/business-type-presets.ts` (mesmo
 * padrão de registro de `core/registry.ts`) — nunca hardcode a lista de
 * ramos aqui: o form só renderiza o que estiver registrado (os que cada
 * vertical registra em `core/load-modules.ts`). Um "Outro" livre continua
 * disponível para não travar a criação de uma organização de um ramo sem
 * preset ainda. */
export function NewOrganizationForm({
  businessTypePresets = [],
}: {
  businessTypePresets?: BusinessTypePreset[];
}) {
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
              list="businessTypePresets"
              placeholder="ex.: bordados, oficina mecânica..."
            />
            <datalist id="businessTypePresets">
              {businessTypePresets.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </datalist>
            {businessTypePresets.length > 0 && (
              <p className="text-muted-foreground text-xs">
                Ramos com preset de módulos: {businessTypePresets.map((p) => p.label).join(", ")} —
                outro valor cria a organização sem módulo pré-habilitado.
              </p>
            )}
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

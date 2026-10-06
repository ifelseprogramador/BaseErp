"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";
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
import { setMemberAccess } from "../actions";
import { ModuleChecklist } from "./module-checklist";

const initialState: ActionResult = { ok: false };

/** Edita o setor e os módulos de uma pessoa da equipe. */
export function MemberAccessDialog({
  membershipId,
  label,
  department,
  selectedSlugs,
  modules,
}: {
  membershipId: string;
  label: string;
  department: string | null;
  selectedSlugs: string[];
  modules: { slug: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  // O fechamento do dialog e o aviso acontecem DENTRO da action (não num
  // effect): setState em effect re-renderiza em cascata.
  const [state, formAction, isPending] = useActionState(
    async (prev: ActionResult, formData: FormData) => {
      const result = await setMemberAccess(membershipId, prev, formData);
      if (result.ok) {
        toast.success("Acesso atualizado.");
        setOpen(false);
      } else if (result.message) {
        toast.error(result.message);
      }
      return result;
    },
    initialState,
  );
  const errors = state.errors ?? {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Settings2 className="h-4 w-4" />
        Acesso
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Acesso de {label}</DialogTitle>
            <DialogDescription>
              Marque os módulos que esta pessoa pode abrir. O que ficar desmarcado some do menu dela
              e fica bloqueado.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`department-${membershipId}`}>Setor (opcional)</Label>
            <Input
              id={`department-${membershipId}`}
              name="department"
              defaultValue={department ?? ""}
              maxLength={60}
              aria-invalid={!!errors.department}
            />
            {errors.department?.map((e) => (
              <p key={e} className="text-destructive text-sm">
                {e}
              </p>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Módulos</span>
            <ModuleChecklist modules={modules} selected={selectedSlugs} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

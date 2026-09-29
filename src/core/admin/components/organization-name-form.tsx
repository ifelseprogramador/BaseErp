"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
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

export function OrganizationNameForm({
  currentName,
  action,
}: {
  currentName: string;
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | undefined>();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await action({ ok: false }, formData);
      if (result.ok) {
        toast.success("Nome atualizado.");
        setOpen(false);
        setErrors({});
        setMessage(undefined);
      } else {
        setErrors(result.errors ?? {});
        setMessage(result.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Editar nome" />}>
        <Pencil className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Renomear organização</DialogTitle>
            <DialogDescription>
              Corrige o nome exibido em todo o sistema — para esta organização e para a equipe dela.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nome da organização</Label>
            <Input id="name" name="name" defaultValue={currentName} required autoFocus />
            {errors.name?.map((e) => (
              <p key={e} className="text-destructive text-sm">
                {e}
              </p>
            ))}
          </div>

          {message && <p className="text-destructive text-sm">{message}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

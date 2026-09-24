"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

/**
 * Par de botões discretos (editar/apagar) pra usar numa célula de tabela
 * — em vez de exigir clicar em cima do nome pra achar a edição. `onDelete`
 * é uma Server Action já vinculada ao id (`.bind(null, id)`, mesmo padrão
 * de `ConfirmDeleteButton`, que continua sendo o botão de remover das
 * páginas de DETALHE — este aqui é só pra listas). Sem `redirectTo`: ao
 * remover, a pessoa continua na lista, que só recarrega
 * (`router.refresh()`) em vez de navegar pra outro lugar.
 */
export function RowActions({
  editHref,
  deleteTitle,
  deleteDescription,
  onDelete,
}: {
  editHref: string;
  deleteTitle?: string;
  deleteDescription?: string;
  onDelete?: () => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    if (!onDelete) return;
    startTransition(async () => {
      const result = await onDelete();
      if (result.ok) {
        toast.success("Removido com sucesso.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "Não foi possível remover.");
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        title="Editar"
        nativeButton={false}
        render={<Link href={editHref} />}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      {onDelete && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button variant="ghost" size="icon-sm" title="Remover" />}>
            <Trash2 className="h-3.5 w-3.5" />
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{deleteTitle}</DialogTitle>
              <DialogDescription>{deleteDescription}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
                {isPending ? "Removendo..." : "Remover"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

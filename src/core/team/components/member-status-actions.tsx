"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, UserCheck, UserX } from "lucide-react";
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
import { resetStaffPassword, setMemberActive } from "../actions";

/** Desativar/reativar uma pessoa da equipe. Desativar libera o assento. */
export function MemberActiveButton({
  membershipId,
  active,
}: {
  membershipId: string;
  active: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await setMemberActive(membershipId, !active);
      if (result.ok) toast.success(active ? "Pessoa desativada." : "Pessoa reativada.");
      else toast.error(result.message ?? "Não foi possível salvar.");
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={isPending}>
      {active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
      {active ? "Desativar" : "Reativar"}
    </Button>
  );
}

/** Nova senha provisória, mostrada uma única vez. */
export function ResetStaffPasswordButton({
  membershipId,
  label,
}: {
  membershipId: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  function handleConfirm() {
    startTransition(async () => {
      const result = await resetStaffPassword(membershipId);
      if (result.ok && result.temporaryPassword) setTemporaryPassword(result.temporaryPassword);
      else toast.error(result.message ?? "Não foi possível resetar a senha.");
    });
  }

  async function handleCopy() {
    if (!temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      toast.success("Senha copiada.");
    } catch {
      toast.error("Não foi possível copiar — selecione o texto manualmente.");
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setTemporaryPassword(null);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <KeyRound className="h-4 w-4" />
        Resetar senha
      </DialogTrigger>
      <DialogContent>
        {temporaryPassword ? (
          <>
            <DialogHeader>
              <DialogTitle>Senha provisória gerada</DialogTitle>
              <DialogDescription>
                Repasse esta senha para {label} por um canal seguro — ela só aparece agora. No
                próximo acesso a pessoa será obrigada a criar uma senha nova.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <code className="bg-muted flex-1 rounded-md px-3 py-2 font-mono text-sm select-all">
                {temporaryPassword}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopy}
                aria-label="Copiar senha"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Fechar</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Resetar senha de {label}</DialogTitle>
              <DialogDescription>
                Gera uma senha provisória e substitui a atual agora — a pessoa não consegue mais
                entrar com a senha antiga. Os dados dela não são afetados.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button onClick={handleConfirm} disabled={isPending}>
                {isPending ? "Gerando..." : "Gerar senha provisória"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

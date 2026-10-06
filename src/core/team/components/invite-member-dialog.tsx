"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, UserPlus } from "lucide-react";
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
import { inviteMember, type InviteMemberResult } from "../actions";
import { ModuleChecklist } from "./module-checklist";

const initialState: InviteMemberResult = { ok: false };

/**
 * Convida alguém para a equipe: e-mail, setor e módulos. Devolve uma senha
 * provisória UMA vez — quem convida repassa por canal seguro; a pessoa é
 * obrigada a trocá-la no primeiro acesso.
 */
export function InviteMemberDialog({
  modules,
  disabled,
}: {
  modules: { slug: string; label: string }[];
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(inviteMember, initialState);
  const errors = state.errors ?? {};

  useEffect(() => {
    if (!state.ok && state.message) toast.error(state.message);
  }, [state]);

  async function handleCopy() {
    if (!state.temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(state.temporaryPassword);
      toast.success("Senha copiada.");
    } catch {
      toast.error("Não foi possível copiar — selecione o texto manualmente.");
    }
  }

  // Ao fechar depois de um convite com sucesso, recarrega o formulário
  // vazio (nova chave) e deixa a senha para trás.
  const [formKey, setFormKey] = useState(0);
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next && state.ok) setFormKey((k) => k + 1);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button disabled={disabled} />}>
        <UserPlus className="h-4 w-4" />
        Adicionar pessoa
      </DialogTrigger>
      <DialogContent>
        {state.ok && state.temporaryPassword ? (
          <>
            <DialogHeader>
              <DialogTitle>Pessoa adicionada</DialogTitle>
              <DialogDescription>
                Repasse o e-mail <strong>{state.email}</strong> e esta senha provisória por um canal
                seguro (WhatsApp, telefone) — ela só aparece agora. No primeiro acesso a pessoa será
                obrigada a criar uma senha nova.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <code className="bg-muted flex-1 rounded-md px-3 py-2 font-mono text-sm select-all">
                {state.temporaryPassword}
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
          <form key={formKey} action={formAction} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Adicionar pessoa à equipe</DialogTitle>
              <DialogDescription>
                Escolha o que ela poderá abrir. Você pode mudar isso depois.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-email">E-mail</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                autoComplete="off"
                required
                aria-invalid={!!errors.email}
              />
              {errors.email?.map((e) => (
                <p key={e} className="text-destructive text-sm">
                  {e}
                </p>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-department">Setor (opcional)</Label>
              <Input
                id="invite-department"
                name="department"
                placeholder="Ex.: Oficina, Financeiro"
                maxLength={60}
              />
              {errors.department?.map((e) => (
                <p key={e} className="text-destructive text-sm">
                  {e}
                </p>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Módulos que ela pode acessar</span>
              <ModuleChecklist modules={modules} selected={[]} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Adicionando..." : "Adicionar"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

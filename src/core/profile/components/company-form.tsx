"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hint } from "@/components/hint";
import type { ActionResult } from "@/core/action-result";
import { formatDocument } from "@/core/document";
import { updateCompanyProfile } from "../company-actions";

const initialState: ActionResult = { ok: false };

export interface CompanyProfile {
  /** Nome da conta (só o dono da plataforma altera) — usado como sugestão. */
  accountName: string;
  displayName: string | null;
  document: string | null;
  phone: string | null;
  address: string | null;
}

/** Dados da empresa que saem nos documentos enviados ao cliente. */
export function CompanyForm({ initial }: { initial: CompanyProfile }) {
  const [state, formAction, isPending] = useActionState(updateCompanyProfile, initialState);
  const errors = state.errors ?? {};
  const [v, setV] = useState({
    displayName: initial.displayName ?? "",
    document: initial.document ? formatDocument(initial.document) : "",
    phone: initial.phone ?? "",
    address: initial.address ?? "",
  });
  const set = (k: keyof typeof v, val: string) => setV((s) => ({ ...s, [k]: val }));

  useEffect(() => {
    if (state.ok) toast.success("Dados da empresa salvos.");
    else if (state.message) toast.error(state.message);
    else {
      const first = Object.keys(errors)[0];
      if (first) document.getElementById(first)?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const field = (
    id: keyof typeof v,
    label: string,
    opts: { hint?: string; placeholder?: string; autoComplete?: string; type?: string } = {},
  ) => (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        {opts.hint && <Hint>{opts.hint}</Hint>}
      </div>
      <Input
        id={id}
        name={id}
        type={opts.type}
        placeholder={opts.placeholder}
        autoComplete={opts.autoComplete}
        value={v[id]}
        onChange={(e) => set(id, e.target.value)}
        aria-invalid={!!errors[id]}
      />
      {errors[id]?.map((e) => (
        <p key={e} className="text-destructive text-sm">
          {e}
        </p>
      ))}
    </div>
  );

  return (
    <form data-unsaved-guard action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        {field("displayName", "Nome nos documentos", {
          placeholder: initial.accountName,
          hint: "É o nome que o cliente vê no topo do orçamento, do PDF e na mensagem de envio. Se deixar em branco, usamos o nome da conta.",
        })}
      </div>
      {field("document", "CNPJ ou CPF", { hint: "Aparece abaixo do nome nos documentos." })}
      {field("phone", "Telefone", { type: "tel", autoComplete: "tel" })}
      <div className="sm:col-span-2">
        {field("address", "Endereço", {
          autoComplete: "street-address",
          placeholder: "Rua, número, bairro, cidade",
        })}
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

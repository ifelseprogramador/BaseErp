"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setOrganizationStatus } from "../actions";

export function OrgStatusToggle({
  organizationId,
  status,
}: {
  organizationId: string;
  status: "active" | "blocked";
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const next = status === "active" ? "blocked" : "active";
    startTransition(async () => {
      const result = await setOrganizationStatus(organizationId, next);
      if (result.ok) {
        toast.success(next === "blocked" ? "Organização bloqueada." : "Organização desbloqueada.");
      } else {
        toast.error(result.message ?? "Não foi possível atualizar.");
      }
    });
  }

  return (
    <Button
      variant={status === "active" ? "destructive" : "default"}
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending
        ? "Aplicando..."
        : status === "active"
          ? "Bloquear organização"
          : "Desbloquear organização"}
    </Button>
  );
}

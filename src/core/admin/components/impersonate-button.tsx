"use client";

import { useTransition } from "react";
import { Headset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startImpersonation } from "../actions";

export function ImpersonateButton({ organizationId }: { organizationId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await startImpersonation(organizationId);
        })
      }
    >
      <Headset className="h-4 w-4" />
      {isPending ? "Entrando..." : "Entrar como suporte"}
    </Button>
  );
}

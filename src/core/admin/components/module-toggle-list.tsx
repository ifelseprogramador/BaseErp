"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { setModuleEnabledForOrg } from "../actions";

export function ModuleToggleList({
  organizationId,
  modules,
}: {
  organizationId: string;
  modules: { slug: string; label: string; enabled: boolean }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {modules.map((m) => (
        <ModuleToggleRow key={m.slug} organizationId={organizationId} module={m} />
      ))}
    </div>
  );
}

function ModuleToggleRow({
  organizationId,
  module: m,
}: {
  organizationId: string;
  module: { slug: string; label: string; enabled: boolean };
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(checked: boolean) {
    startTransition(async () => {
      const result = await setModuleEnabledForOrg(organizationId, m.slug, checked);
      if (result.ok) {
        toast.success(`${m.label} ${checked ? "ativado" : "desativado"} para esta organização.`);
      } else {
        toast.error(result.message ?? "Não foi possível salvar.");
      }
    });
  }

  return (
    <div className="flex items-center justify-between">
      <Label htmlFor={`module-${m.slug}`}>{m.label}</Label>
      <Switch
        id={`module-${m.slug}`}
        checked={m.enabled}
        disabled={isPending}
        onCheckedChange={handleChange}
      />
    </div>
  );
}

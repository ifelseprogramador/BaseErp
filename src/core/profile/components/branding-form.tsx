"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/core/action-result";
import { resetOrganizationColor, updateOrganizationBranding } from "../actions";

const initialState: ActionResult = { ok: false };

export function BrandingForm({
  primaryColor,
  logoUrl,
}: {
  primaryColor: string | null;
  logoUrl: string | null;
}) {
  const [state, formAction, isPending] = useActionState(updateOrganizationBranding, initialState);
  const errors = state.errors ?? {};
  const [preview, setPreview] = useState<string | null>(logoUrl);
  const [isResetting, startReset] = useTransition();

  useEffect(() => {
    if (state.ok) toast.success("Aparência atualizada.");
  }, [state]);

  function handleResetColor() {
    startReset(async () => {
      const result = await resetOrganizationColor();
      if (result.ok) {
        toast.success("Cor restaurada para o padrão do sistema.");
      } else {
        toast.error(result.message ?? "Não foi possível restaurar a cor.");
      }
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="primaryColor">Cor primária</Label>
        <div className="flex items-center gap-2">
          {/* `key` força o input a remontar quando `primaryColor` muda
              via revalidação do server (ex.: depois de restaurar) — um
              input `type="color"` não controlado não reflete um novo
              `defaultValue` sozinho. */}
          <Input
            key={primaryColor ?? "default"}
            id="primaryColor"
            name="primaryColor"
            type="color"
            defaultValue={primaryColor ?? "#2563eb"}
            className="h-10 w-16 p-1"
          />
          <span className="text-muted-foreground text-sm">
            Aplicada nos botões e destaques para toda a equipe.
          </span>
          {primaryColor && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isResetting}
              onClick={handleResetColor}
            >
              <RotateCcw className="h-4 w-4" />
              {isResetting ? "Restaurando..." : "Restaurar cor padrão"}
            </Button>
          )}
        </div>
        {errors.primaryColor?.map((e) => (
          <p key={e} className="text-destructive text-sm">
            {e}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="logo">Logo</Label>
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element -- URL dinâmica do Supabase Storage, fora do domínio de imagens do Next.
          <img src={preview} alt="Logo atual" className="h-12 w-auto rounded border bg-white p-1" />
        )}
        <Input
          id="logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setPreview(URL.createObjectURL(file));
          }}
        />
        <p className="text-muted-foreground text-sm">PNG, JPG, SVG ou WebP, até 2 MB.</p>
        {errors.logo?.map((e) => (
          <p key={e} className="text-destructive text-sm">
            {e}
          </p>
        ))}
      </div>

      {state.message && <p className="text-destructive text-sm">{state.message}</p>}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar aparência"}
        </Button>
      </div>
    </form>
  );
}

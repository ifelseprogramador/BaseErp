"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/core/action-result";
import {
  resetOrganizationColor,
  resetOrganizationLogo,
  resetSidebarColor,
  updateOrganizationBranding,
} from "../actions";

const initialState: ActionResult = { ok: false };

/** Lê a cor de verdade que o navegador está aplicando pra uma variável
 * CSS do tema (ex.: `--primary`), respeitando modo claro/escuro — não
 * dá pra saber isso sem perguntar pro DOM (a variável vem de OKLCH em
 * `globals.css`, um `<input type="color">` só aceita hex). Usado só
 * como valor inicial do seletor quando não há override salvo: sem isso,
 * o seletor mostraria um azul arbitrário no primeiro acesso em vez da
 * cor padrão de verdade do sistema. */
function resolveCssVarAsHex(cssVar: string): string | null {
  if (typeof window === "undefined") return null;
  const probe = document.createElement("div");
  probe.style.color = `var(${cssVar})`;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  const parts = rgb.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return null;
  const [r, g, b] = parts.map((n) => Math.round(Number(n)));
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/** Um seletor de cor com botão "Restaurar padrão" próprio — reaproveitado
 * pra cor de destaque e cor do menu lateral, que são overrides
 * independentes (ver `components/org-branding-style.tsx`). */
function ColorPickerField({
  name,
  label,
  helpText,
  color,
  cssVar,
  onReset,
  error,
}: {
  name: string;
  label: string;
  helpText: string;
  color: string | null;
  /** Variável CSS do tema (ex.: `--primary`) usada só quando `color` é
   * nulo, pra mostrar a cor padrão de verdade em vez de um azul fixo. */
  cssVar: string;
  onReset: () => void;
  error?: string[];
}) {
  const [isResetting, startReset] = useTransition();
  const [systemDefault, setSystemDefault] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura de getComputedStyle (sistema externo, o DOM) não existe durante o render, só depois de montado — exatamente o caso que a doc do React cita como uso válido de efeito.
    if (color === null) setSystemDefault(resolveCssVarAsHex(cssVar));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só precisa reler quando o override sai (color vira null), não a cada render.
  }, [color]);

  const shownColor = color ?? systemDefault ?? "#2563eb";

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        {/* `key` força o input a remontar quando o valor mostrado muda
            (override salvo, restaurado, ou cor padrão resolvida depois
            do mount) — um input `type="color"` não controlado não
            reflete um novo `defaultValue` sozinho. */}
        <Input
          key={shownColor}
          id={name}
          name={name}
          type="color"
          defaultValue={shownColor}
          className="h-10 w-16 p-1"
        />
        <span className="text-muted-foreground text-sm">{helpText}</span>
        {color && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isResetting}
            onClick={() => startReset(onReset)}
          >
            <RotateCcw className="h-4 w-4" />
            {isResetting ? "Restaurando..." : "Restaurar padrão"}
          </Button>
        )}
      </div>
      {error?.map((e) => (
        <p key={e} className="text-destructive text-sm">
          {e}
        </p>
      ))}
    </div>
  );
}

export function BrandingForm({
  primaryColor,
  sidebarColor,
  logoUrl,
}: {
  primaryColor: string | null;
  sidebarColor: string | null;
  logoUrl: string | null;
}) {
  const [state, formAction, isPending] = useActionState(updateOrganizationBranding, initialState);
  const errors = state.errors ?? {};
  // Só guarda o arquivo escolhido AGORA (preview instantâneo antes de
  // salvar) — o preview do que já está salvo vem direto da prop
  // `logoUrl`, nunca copiado pra um state próprio (evitaria precisar de
  // um efeito só pra ressincronizar quando o server revalida depois de
  // salvar/remover).
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const preview = filePreview ?? logoUrl;
  const [isRemovingLogo, startRemoveLogo] = useTransition();

  useEffect(() => {
    if (state.ok) toast.success("Aparência atualizada.");
  }, [state]);

  async function handleResetPrimary() {
    const result = await resetOrganizationColor();
    if (result.ok) {
      toast.success("Cor de destaque restaurada para o padrão do sistema.");
    } else {
      toast.error(result.message ?? "Não foi possível restaurar a cor.");
    }
  }

  async function handleResetSidebar() {
    const result = await resetSidebarColor();
    if (result.ok) {
      toast.success("Cor do menu lateral restaurada para o padrão do sistema.");
    } else {
      toast.error(result.message ?? "Não foi possível restaurar a cor.");
    }
  }

  function handleRemoveLogo() {
    startRemoveLogo(async () => {
      const result = await resetOrganizationLogo();
      if (result.ok) {
        toast.success("Logo removido — voltou pra marca oficial do sistema.");
      } else {
        toast.error(result.message ?? "Não foi possível remover o logo.");
      }
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ColorPickerField
        name="primaryColor"
        label="Cor de destaque (botões)"
        helpText="Aplicada nos botões e destaques em todo o sistema."
        color={primaryColor}
        cssVar="--primary"
        onReset={handleResetPrimary}
        error={errors.primaryColor}
      />

      <ColorPickerField
        name="sidebarColor"
        label="Cor do menu lateral"
        helpText="Fundo do menu à esquerda — o texto se ajusta sozinho pra continuar legível."
        color={sidebarColor}
        cssVar="--sidebar"
        onReset={handleResetSidebar}
        error={errors.sidebarColor}
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="logo">Logo</Label>
        {preview && (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL dinâmica do Supabase Storage, fora do domínio de imagens do Next. */}
            <img
              src={preview}
              alt="Logo atual"
              // `self-start`: sem isso, o container flex esticava a
              // imagem pra largura total, deformando ela — `w-auto`
              // sozinho não basta porque `width: auto` ainda conta como
              // "auto" pro stretch do flex.
              className="h-12 w-auto self-start rounded border bg-white object-contain p-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isRemovingLogo}
              onClick={handleRemoveLogo}
            >
              <X className="h-4 w-4" />
              {isRemovingLogo ? "Removendo..." : "Remover logo"}
            </Button>
          </div>
        )}
        <Input
          id="logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setFilePreview(URL.createObjectURL(file));
          }}
        />
        <p className="text-muted-foreground text-sm">
          PNG, JPG, SVG ou WebP, até 2 MB. Sem logo, o sistema mostra a marca oficial.
        </p>
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

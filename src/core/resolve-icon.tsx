import { icons, HelpCircle, type LucideIcon } from "lucide-react";

/**
 * Resolve o nome de um ícone (string, vindo de `ModuleDefinition.iconName`)
 * para o componente real do lucide-react — sempre do lado do cliente
 * (dentro de um componente `"use client"`), nunca recebendo o componente
 * já resolvido como prop de um Server Component. Ver o comentário em
 * `core/registry.ts#ModuleDefinition`.
 */
export function resolveIcon(name: string): LucideIcon {
  return icons[name as keyof typeof icons] ?? HelpCircle;
}

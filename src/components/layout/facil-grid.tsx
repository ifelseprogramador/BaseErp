"use client";

import { usePathname } from "next/navigation";
import { DatabaseBackup, LayoutDashboard } from "lucide-react";
import { resolveIcon } from "@/core/resolve-icon";
import type { ModuleDefinition } from "@/core/registry";
import { FacilTile } from "@/components/facil/facil-tile";

/**
 * Grade de cards com todos os módulos liberados para a pessoa (Início,
 * módulos e, para o dono, Backup). Lê só de `modules`, como o `SidebarNav`
 * — nenhum link de módulo é hardcoded. Usada no "Todos os módulos"
 * (`facil/facil-nav.tsx`) e no Início do modo Fácil.
 */
export function FacilGrid({
  modules,
  isOwner,
  size,
  includePainel = true,
  onNavigate,
}: {
  modules: ModuleDefinition[];
  isOwner: boolean;
  size: "menu" | "painel";
  includePainel?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const items = [
    ...(includePainel
      ? [{ slug: "dashboard", label: "Início", href: "/", icon: LayoutDashboard }]
      : []),
    ...modules.map((m) => ({
      slug: m.slug,
      label: m.label,
      href: m.href,
      icon: resolveIcon(m.iconName),
    })),
    ...(isOwner
      ? [{ slug: "backup", label: "Backup", href: "/backup", icon: DatabaseBackup }]
      : []),
  ];

  return (
    <nav
      aria-label="Atalhos"
      className={
        size === "painel"
          ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          : "grid grid-cols-2 gap-3 p-3"
      }
    >
      {items.map((item, index) => (
        <FacilTile
          key={item.slug}
          href={item.href}
          label={item.label}
          icon={item.icon}
          index={index}
          size={size === "painel" ? "lg" : "md"}
          active={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)}
          onClick={onNavigate}
        />
      ))}
    </nav>
  );
}

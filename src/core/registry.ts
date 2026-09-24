import type { icons as LucideIcons } from "lucide-react";

/**
 * Metadados que cada módulo declara em `modules/<modulo>/module.ts`. O
 * menu lateral (`components/layout/sidebar-nav.tsx`) e futuramente o
 * controle de permissões leem só daqui — nunca há uma lista de rotas
 * hardcoded na UI.
 *
 * Para remover uma funcionalidade: apague a pasta `modules/<modulo>/` e
 * tire a entrada de `load-modules.ts`. Para desligar sem apagar (ex.:
 * testar em produção antes de remover de vez), marque `enabled: false`.
 */
export interface ModuleDefinition {
  slug: string;
  label: string;
  /**
   * Nome do ícone do lucide-react (ex.: "Users", "Package") — string, não
   * o componente. `getEnabledModules()` é lido por Server Components e
   * passado para componentes cliente (sidebar/drawer); React não permite
   * serializar uma função (o componente do ícone) nessa fronteira, então
   * o valor aqui precisa ser só dado. `core/resolve-icon.tsx` resolve o
   * nome para o componente do lado do cliente.
   */
  iconName: keyof typeof LucideIcons;
  /** Rota base do módulo dentro de `app/(app)/`. */
  href: string;
  /** Ordem no menu lateral, crescente. */
  order: number;
  enabled: boolean;
  /**
   * Slugs de outros módulos dos quais este depende. Puramente documental
   * por enquanto — serve de aviso para quem for desligar um módulo do
   * qual outro depende.
   */
  dependsOn?: string[];
}

// Populado por cada `modules/<modulo>/module.ts` importado a partir de
// `core/load-modules.ts`. Mantido vazio aqui de propósito: este arquivo é
// infraestrutura, não deve conhecer módulos individuais além de
// importá-los. Neste projeto (BaseERP) fica vazio o tempo todo — nenhum
// módulo de negócio nasce aqui, só em um vertical.
const MODULES: ModuleDefinition[] = [];

export function getEnabledModules(): ModuleDefinition[] {
  return [...MODULES].filter((m) => m.enabled).sort((a, b) => a.order - b.order);
}

/** Todos os módulos registrados, habilitados ou não — usado pela tela de
 * personalização por organização em /admin (precisa listar até os
 * desligados). */
export function getAllModules(): ModuleDefinition[] {
  return [...MODULES].sort((a, b) => a.order - b.order);
}

export function registerModule(definition: ModuleDefinition) {
  MODULES.push(definition);
}

/** Só para testes: limpa o registro entre casos (o array é module-level,
 * sobreviveria entre `it()` diferentes sem isso). */
export function __resetRegistryForTests() {
  MODULES.length = 0;
}

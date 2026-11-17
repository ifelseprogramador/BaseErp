/**
 * Preset de módulos por `organizations.businessType` (ver comentário em
 * `db/schema/tenancy.ts#organizations.businessType`). Mesmo padrão de
 * registro de `core/registry.ts` (registerX + array module-level) — só
 * decide quais `organization_module_settings` são semeados como
 * habilitados quando uma organização nasce com aquele ramo, na tela
 * "Nova organização" do admin (`core/admin/actions.ts#createOrganization`).
 *
 * IMPORTANTE (mesma regra do registry de módulos, ver
 * `src/modules/README.md`, regra 10): nenhum módulo de negócio pode ler
 * `organizations.businessType` diretamente. Este arquivo é o único lugar
 * que traduz um preset em módulos habilitados — e só é consultado uma vez,
 * no momento de criar a organização (a partir daí, quem manda é
 * `organization_module_settings`, editável livremente pelo admin,
 * independente do preset original).
 *
 * No BaseERP o registro nasce VAZIO (não há módulo de negócio para presetar):
 * cada vertical registra seus presets em `core/load-modules.ts`, com
 * `registerBusinessTypePreset(...)`.
 */

export interface BusinessTypePreset {
  value: string;
  label: string;
  /** Slugs de `ModuleDefinition` (ver `core/registry.ts`) habilitados por
   * padrão para uma organização criada com este preset. */
  defaultModuleSlugs: string[];
}

const BUSINESS_TYPE_PRESETS: BusinessTypePreset[] = [];

export function registerBusinessTypePreset(preset: BusinessTypePreset) {
  BUSINESS_TYPE_PRESETS.push(preset);
}

export function getBusinessTypePresets(): BusinessTypePreset[] {
  return [...BUSINESS_TYPE_PRESETS];
}

export function getBusinessTypePreset(
  value: string | null | undefined,
): BusinessTypePreset | undefined {
  if (!value) return undefined;
  return BUSINESS_TYPE_PRESETS.find((p) => p.value === value);
}

/** Só para testes: limpa o registro entre casos (array module-level). */
export function __resetBusinessTypePresetsForTests() {
  BUSINESS_TYPE_PRESETS.length = 0;
}

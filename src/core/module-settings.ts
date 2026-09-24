import "server-only";
import { eq } from "drizzle-orm";
import type { Database } from "@/core/db";
import { organizationModuleSettings } from "@/db/schema";
import { getAllModules, type ModuleDefinition } from "@/core/registry";

/**
 * Parte pura da lógica (testável sem banco): módulos habilitados para UMA
 * organização, combinando o padrão global de cada `module.ts`
 * (`enabled`) com o override por linha em `organization_module_settings`
 * quando o admin personalizou algo para aquela organização (ver
 * `core/admin/actions.ts#setModuleEnabledForOrg`).
 */
export function computeEnabledModules(
  allModules: ModuleDefinition[],
  overrides: { moduleSlug: string; enabled: boolean }[],
): ModuleDefinition[] {
  const overrideBySlug = new Map(overrides.map((o) => [o.moduleSlug, o.enabled]));
  return allModules
    .filter((m) => overrideBySlug.get(m.slug) ?? m.enabled)
    .sort((a, b) => a.order - b.order);
}

/**
 * Wrapper com acesso a banco. `db` já deve estar dentro do contexto RLS
 * da sessão atual — passe o handle recebido de `withOrg()#withDb` (ou de
 * `requireAdmin()#withDb`), nunca `core/db.ts#db` puro (RLS bloquearia a
 * leitura de `organization_module_settings`, ver docs/decisoes.md).
 */
export async function getEnabledModulesForOrg(
  db: Database,
  organizationId: string,
): Promise<ModuleDefinition[]> {
  const overrides = await db
    .select({
      moduleSlug: organizationModuleSettings.moduleSlug,
      enabled: organizationModuleSettings.enabled,
    })
    .from(organizationModuleSettings)
    .where(eq(organizationModuleSettings.organizationId, organizationId));

  return computeEnabledModules(getAllModules(), overrides);
}

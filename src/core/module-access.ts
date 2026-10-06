/**
 * Acesso por módulo dentro de uma organização multiusuário — parte pura
 * (testável sem banco). Quem decide o que cada pessoa `staff` enxerga é o
 * dono da conta, em `/equipe` (`core/team/actions.ts#setMemberModules`),
 * sempre dentro dos módulos que o dono da plataforma habilitou para a
 * organização (`organization_module_settings`).
 *
 * `owner` (e o admin em modo suporte) acessa tudo: `{ all: true }`.
 * `staff` só acessa os slugs listados em `membership_modules`.
 */
export type ModuleAccess = { all: true } | { all: false; slugs: ReadonlySet<string> };

export const FULL_MODULE_ACCESS: ModuleAccess = { all: true };

export function buildModuleAccess(
  role: "owner" | "staff",
  grantedSlugs: Iterable<string>,
): ModuleAccess {
  if (role === "owner") return FULL_MODULE_ACCESS;
  return { all: false, slugs: new Set(grantedSlugs) };
}

export function canAccessModule(access: ModuleAccess, slug: string): boolean {
  return access.all || access.slugs.has(slug);
}

export function filterModulesByAccess<T extends { slug: string }>(
  modules: T[],
  access: ModuleAccess,
): T[] {
  return access.all ? modules : modules.filter((m) => access.slugs.has(m.slug));
}

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

/**
 * Fecha a lista de módulos liberados sob `dependsOn` (declarado em cada
 * `module.ts`): quem recebe "pedidos" também precisa ler "clientes", senão
 * a tela de pedido quebra ao listar clientes. Transitivo; ignora slug
 * desconhecido. Aplicado ao GRAVAR as permissões (`core/team/actions.ts`),
 * então o que está em `membership_modules` já vem completo.
 */
export function expandWithDependencies(
  slugs: Iterable<string>,
  modules: { slug: string; dependsOn?: string[] }[],
): string[] {
  const bySlug = new Map(modules.map((m) => [m.slug, m]));
  const result = new Set<string>();
  const stack = [...slugs];
  while (stack.length > 0) {
    const slug = stack.pop()!;
    if (result.has(slug) || !bySlug.has(slug)) continue;
    result.add(slug);
    stack.push(...(bySlug.get(slug)!.dependsOn ?? []));
  }
  return [...result];
}

export function filterModulesByAccess<T extends { slug: string }>(
  modules: T[],
  access: ModuleAccess,
): T[] {
  return access.all ? modules : modules.filter((m) => access.slugs.has(m.slug));
}

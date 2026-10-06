/**
 * Lista de módulos com caixa de marcar — o dono da conta escolhe o que
 * cada pessoa pode abrir. Campos `moduleSlugs` (um por módulo marcado),
 * lidos por `core/team/validation.ts`.
 */
export function ModuleChecklist({
  modules,
  selected,
}: {
  modules: { slug: string; label: string; dependsOn?: string[] }[];
  selected: string[];
}) {
  if (modules.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Nenhum módulo habilitado nesta empresa ainda.</p>
    );
  }

  const selectedSet = new Set(selected);
  const labelBySlug = new Map(modules.map((m) => [m.slug, m.label]));
  return (
    <div className="flex flex-col gap-2">
      {modules.map((m) => (
        <label key={m.slug} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="moduleSlugs"
            value={m.slug}
            defaultChecked={selectedSet.has(m.slug)}
            className="h-4 w-4"
          />
          <span>
            {m.label}
            {m.dependsOn && m.dependsOn.length > 0 && (
              <span className="text-muted-foreground text-xs">
                {" "}
                (também libera {m.dependsOn.map((d) => labelBySlug.get(d) ?? d).join(", ")})
              </span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}

import type { LucideIcon } from "lucide-react";

export interface FacilInfoRow {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  /** Com `href`, o valor vira link (`tel:`, `mailto:` ou uma ficha). */
  href?: string;
}

/**
 * Linhas "ícone · rótulo · valor" da ficha de um registro no modo Fácil.
 * Linhas sem valor são omitidas — só aparece o que existe.
 */
export function FacilInfo({ rows }: { rows: FacilInfoRow[] }) {
  const shown = rows.filter(
    (row) => row.value !== null && row.value !== undefined && row.value !== "",
  );
  if (shown.length === 0) return null;
  return (
    <dl className="bg-card divide-y rounded-2xl ring-1 ring-black/5 dark:ring-white/10">
      {shown.map(({ icon: Icon, label, value, href }) => (
        <div key={label} className="flex items-center gap-4 p-4">
          <Icon className="text-primary h-6 w-6 shrink-0" />
          <dt className="text-muted-foreground w-28 shrink-0">{label}</dt>
          <dd className="min-w-0 text-lg font-medium break-words">
            {href ? (
              <a href={href} className="hover:underline">
                {value}
              </a>
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

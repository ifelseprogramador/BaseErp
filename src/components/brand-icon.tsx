import { BRAND } from "@/core/brand";

/** Ícone da marca do vertical (`core/brand.ts#iconPaths`) — renderizado
 * como SVG cru em vez de importar um componente lucide-react específico,
 * pra este arquivo (e quem o usa: sidebar, header) ficar idêntico entre
 * o BaseERP e cada vertical, mudando só o que `core/brand.ts` exporta. */
export function BrandIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {BRAND.iconPaths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

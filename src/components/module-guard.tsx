import { ShieldAlert } from "lucide-react";
import { withOrg } from "@/core/auth";
import { canAccessModule } from "@/core/module-access";

/**
 * Casca de tela para o `layout.tsx` de cada módulo (`app/(app)/<modulo>/`):
 * quem não tem o módulo liberado pelo responsável da conta vê um aviso em
 * vez de um erro. É só UX — a proteção de verdade é `requireModule()` em
 * toda Server Action, consulta e rota do módulo (um layout não re-executa
 * em toda navegação interna, nem protege uma Server Action chamada
 * direto).
 *
 *   export default function Layout({ children }) {
 *     return <ModuleGuard slug="clientes">{children}</ModuleGuard>;
 *   }
 */
export async function ModuleGuard({ slug, children }: { slug: string; children: React.ReactNode }) {
  const { moduleAccess } = await withOrg();
  if (canAccessModule(moduleAccess, slug)) return <>{children}</>;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <ShieldAlert className="text-muted-foreground h-8 w-8" />
      <h1 className="text-lg font-semibold">Sem acesso a esta área</h1>
      <p className="text-muted-foreground text-sm">
        O responsável pela conta não liberou este módulo para você. Fale com ele se precisar de
        acesso.
      </p>
    </div>
  );
}

import { cache } from "react";
import { withOrg } from "@/core/auth";
import { getUiMode } from "@/core/profile/ui-mode";
import type { UiMode } from "@/core/ui-mode";

/**
 * Modo de tela da pessoa logada, para as páginas dos módulos escolherem a
 * variante (formal/fácil). `cache` do React junta as chamadas da mesma
 * requisição (layout + página), então não custa uma consulta por tela.
 */
export const getCurrentUiMode = cache(async (): Promise<UiMode> => {
  const { userId, withDb } = await withOrg();
  return withDb((tx) => getUiMode(tx, userId));
});

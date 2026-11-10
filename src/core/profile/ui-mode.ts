import { eq } from "drizzle-orm";
import type { Database } from "@/core/db";
import { userPreferences } from "@/db/schema";
import { DEFAULT_UI_MODE, isUiMode, type UiMode } from "@/core/ui-mode";

/** Código do Postgres para "tabela não existe" (undefined_table). */
const UNDEFINED_TABLE = "42P01";

/**
 * Erro de tabela inexistente, venha ele cru do driver ou embrulhado pelo
 * Drizzle (que guarda o original em `cause`). Só este erro é tolerado: uma
 * queda de conexão ou uma RLS quebrada continuam estourando.
 */
export function isMissingTableError(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    if ((current as { code?: unknown }).code === UNDEFINED_TABLE) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Modo de interface da pessoa; sem linha gravada (ou valor desconhecido)
 * vale o padrão formal.
 *
 * Tolerante a deploy fora de ordem: o layout lê isto em TODA página, então
 * se o código novo subir antes de `user_preferences` existir, devolve o
 * padrão em vez de derrubar o sistema inteiro. A leitura roda num
 * savepoint (`tx.transaction`) — sem ele, o erro invalidaria a transação
 * inteira de quem chamou e as próximas consultas da página também falhariam.
 */
export async function getUiMode(tx: Database, userId: string): Promise<UiMode> {
  try {
    const [row] = await tx.transaction((sp) =>
      sp
        .select({ uiMode: userPreferences.uiMode })
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1),
    );
    return isUiMode(row?.uiMode) ? row.uiMode : DEFAULT_UI_MODE;
  } catch (err) {
    if (isMissingTableError(err)) return DEFAULT_UI_MODE;
    throw err;
  }
}

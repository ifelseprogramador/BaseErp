import "server-only";
import { headers } from "next/headers";
import { getSession } from "@/core/auth";
import { runWithUserContext, type Database } from "@/core/db";
import { isPlatformAdmin } from "@/core/platform-admin";
import { logger, type Logger } from "@/core/logger";

export class NotPlatformAdminError extends Error {
  constructor(message = "Acesso restrito ao dono da plataforma.") {
    super(message);
    this.name = "NotPlatformAdminError";
  }
}

async function getRequestId(): Promise<string | undefined> {
  try {
    return (await headers()).get("x-request-id") ?? undefined;
  } catch {
    return undefined;
  }
}

export interface AdminContext {
  userId: string;
  log: Logger;
  /**
   * Roda `fn` dentro de uma transação com `app.current_user_id` = este
   * admin. Diferente do mecano-erp (onde a conexão do app já enxerga
   * tudo via `bypassrls`), aqui a RLS é ativa mesmo para o admin — a
   * visibilidade total de `/admin` vem da policy
   * `is_current_user_platform_admin()` (ver
   * migrations-custom/0002_platform_admin_rls.sql), não de a conexão
   * ignorar RLS. A proteção real continua sendo esta checagem
   * (`requireAdmin()`) acontecer antes de qualquer query — nunca pule
   * esta chamada numa rota/action nova de `/admin`.
   */
  withDb: <T>(fn: (tx: Database) => Promise<T>) => Promise<T>;
}

/** Ponto de entrada de toda query/action da área `/admin`. */
export async function requireAdmin(): Promise<AdminContext> {
  const requestId = await getRequestId();
  const user = await getSession();

  if (!user) {
    logger.warn("admin.acesso_negado", { requestId, reason: "sem_sessao" });
    throw new NotPlatformAdminError("Faça login para acessar a área administrativa.");
  }

  if (!(await isPlatformAdmin(user.id))) {
    logger.warn("admin.acesso_negado", { requestId, userId: user.id, reason: "nao_e_admin" });
    throw new NotPlatformAdminError();
  }

  return {
    userId: user.id,
    log: logger.withContext({ requestId, userId: user.id, module: "admin" }),
    withDb: (fn) => runWithUserContext(user.id, fn),
  };
}

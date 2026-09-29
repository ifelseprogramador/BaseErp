import "server-only";
import { headers, cookies } from "next/headers";
import { eq } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/core/supabase/server";
import { runWithUserContext, type Database } from "@/core/db";
import { memberships, organizations } from "@/db/schema";
import { logger, type Logger } from "@/core/logger";
import { isPlatformAdmin } from "@/core/platform-admin";
import { IMPERSONATION_COOKIE } from "@/core/impersonation";

export class UnauthorizedError extends Error {
  constructor(message = "Usuário não autenticado.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class NoActiveOrganizationError extends Error {
  constructor(message = "Usuário não pertence a nenhuma organização.") {
    super(message);
    this.name = "NoActiveOrganizationError";
  }
}

/**
 * A organização (ou o membership da pessoa dentro dela) foi bloqueada
 * pelo dono da plataforma — normalmente por falta de pagamento. Ver
 * `core/admin/actions.ts#setOrganizationStatus`.
 */
export class OrganizationBlockedError extends Error {
  constructor(message = "Acesso bloqueado.") {
    super(message);
    this.name = "OrganizationBlockedError";
  }
}

/** Sessão do usuário autenticado, lida do cookie do Supabase Auth. */
export async function getSession() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * `true` quando a pessoa precisa trocar a senha antes de acessar
 * qualquer outra tela — setado em `app_metadata` (só editável via Admin
 * API/service role, nunca pelo próprio usuário) por
 * `core/admin/actions.ts#createOrganization` (usuário novo, senha
 * inicial) e `#resetMemberPassword` (reset feito pelo dono da
 * plataforma). Zerado por `core/profile/actions.ts#setNewPassword`
 * depois que a pessoa define uma senha própria. Ver
 * `app/(auth)/trocar-senha-obrigatoria/` e o gate nos layouts de
 * `(app)`/`(admin)`.
 */
export function mustChangePassword(user: User): boolean {
  return user.app_metadata?.must_change_password === true;
}

/**
 * Se o cookie de modo suporte estiver presente E o usuário da sessão
 * atual for mesmo um platform admin agora (reconfirmado a cada chamada —
 * o cookie sozinho nunca é suficiente), devolve o id da organização que
 * ele está "acessando como". `null` em qualquer outro caso.
 */
async function getImpersonatedOrgId(userId: string): Promise<string | null> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  if (!orgId) return null;

  if (!(await isPlatformAdmin(userId))) {
    // Sessão comum com um cookie de suporte "órfão". Nunca honrar — mas
    // não é uma ação do próprio usuário, não vale a pena tentar apagar o
    // cookie aqui (Server Component é somente leitura); a action de
    // logout/stopImpersonation limpa.
    return null;
  }

  return orgId;
}

interface ActiveOrgResult {
  userId: string;
  userEmail: string | undefined;
  organizationId: string;
  organizationName: string;
  role: "owner" | "staff";
  impersonating: boolean;
  organizationStatus: "active" | "blocked";
  primaryColor: string | null;
  sidebarColor: string | null;
  logoUrl: string | null;
}

/**
 * A organização ativa do usuário + seu papel nela.
 *
 * Simplificação do MVP: sem troca de organização (uma pessoa pertence a
 * uma organização só) — pega o primeiro membership. Trocar isso por uma
 * organização "ativa" escolhida pelo usuário é a mudança principal para
 * virar multi-organização por pessoa.
 *
 * Exceção: um platform admin em modo suporte (ver `core/impersonation.ts`)
 * "vira" o dono da organização que está acessando, mesmo sem membership.
 *
 * Todas as leituras aqui passam por `runWithUserContext(user.id, ...)`
 * (RLS ativa — ver docs/decisoes.md): sem isso, a policy de `organizations`/
 * `memberships` não libera nenhuma linha.
 */
export async function getActiveOrg(): Promise<ActiveOrgResult> {
  const user = await getSession();
  if (!user) {
    throw new UnauthorizedError();
  }

  const impersonatedOrgId = await getImpersonatedOrgId(user.id);

  return runWithUserContext(user.id, async (tx) => {
    if (impersonatedOrgId) {
      const [org] = await tx
        .select({
          id: organizations.id,
          name: organizations.name,
          status: organizations.status,
          primaryColor: organizations.primaryColor,
          sidebarColor: organizations.sidebarColor,
          logoUrl: organizations.logoUrl,
        })
        .from(organizations)
        .where(eq(organizations.id, impersonatedOrgId))
        .limit(1);

      if (org) {
        return {
          userId: user.id,
          userEmail: user.email,
          organizationId: org.id,
          organizationName: org.name,
          role: "owner",
          impersonating: true,
          organizationStatus: org.status,
          primaryColor: org.primaryColor,
          sidebarColor: org.sidebarColor,
          logoUrl: org.logoUrl,
        };
      }
      // Organização foi apagada durante o modo suporte — cai para o
      // fluxo normal abaixo (provavelmente vira NoActiveOrganizationError).
    }

    const [membership] = await tx
      .select({
        organizationId: memberships.organizationId,
        role: memberships.role,
        membershipActive: memberships.active,
        organizationName: organizations.name,
        organizationStatus: organizations.status,
        primaryColor: organizations.primaryColor,
        sidebarColor: organizations.sidebarColor,
        logoUrl: organizations.logoUrl,
      })
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
      .where(eq(memberships.userId, user.id))
      .limit(1);

    if (!membership) {
      throw new NoActiveOrganizationError();
    }

    if (membership.organizationStatus === "blocked" || !membership.membershipActive) {
      throw new OrganizationBlockedError();
    }

    return {
      userId: user.id,
      userEmail: user.email,
      organizationId: membership.organizationId,
      organizationName: membership.organizationName,
      role: membership.role,
      impersonating: false,
      organizationStatus: "active", // já teria lançado acima se bloqueada
      primaryColor: membership.primaryColor,
      sidebarColor: membership.sidebarColor,
      logoUrl: membership.logoUrl,
    };
  });
}

async function getRequestId(): Promise<string | undefined> {
  try {
    const headerList = await headers();
    return headerList.get("x-request-id") ?? undefined;
  } catch {
    // Fora de um request (ex.: script de seed) não há headers.
    return undefined;
  }
}

export interface OrgContext {
  organizationId: string;
  userId: string;
  role: "owner" | "staff";
  impersonating: boolean;
  log: Logger;
  /**
   * Único jeito sancionado de consultar/gravar dado de organização: roda
   * `fn` dentro de uma transação com a RLS já liberando as linhas deste
   * usuário (ver `core/db.ts#runWithUserContext`). Nunca importe
   * `core/db.ts#db` direto de dentro de um módulo — sem isso, a RLS
   * bloqueia tudo.
   */
  withDb: <T>(fn: (tx: Database) => Promise<T>) => Promise<T>;
}

/**
 * Ponto de entrada padrão de toda Server Action e query de módulo:
 * resolve a sessão + organização ativa e devolve um logger já
 * contextualizado (requestId, userId, organizationId) — nenhum módulo
 * deve montar esse contexto na mão. Lança `UnauthorizedError`/
 * `NoActiveOrganizationError`/`OrganizationBlockedError` quando não há
 * sessão ou organização válida.
 *
 * Uso:
 *   const { withDb, organizationId, log } = await withOrg();
 *   log.info("clientes.listar");
 *   return withDb((tx) =>
 *     tx.query.customers.findMany({ where: eq(customers.organizationId, organizationId) }),
 *   );
 */
export async function withOrg(): Promise<OrgContext> {
  const requestId = await getRequestId();
  const context = await getActiveOrg().catch((err) => {
    logger.warn("auth.acesso_negado", {
      requestId,
      reason: err instanceof Error ? err.name : "unknown",
    });
    throw err;
  });

  return {
    userId: context.userId,
    organizationId: context.organizationId,
    role: context.role,
    impersonating: context.impersonating,
    log: logger.withContext({
      requestId,
      userId: context.userId,
      organizationId: context.organizationId,
      ...(context.impersonating && { impersonating: true }),
    }),
    withDb: (fn) => runWithUserContext(context.userId, fn),
  };
}

import "server-only";
import { headers, cookies } from "next/headers";
import { asc, eq } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/core/supabase/server";
import { runWithUserContext, type Database } from "@/core/db";
import { membershipModules, memberships, organizations } from "@/db/schema";
import {
  FULL_MODULE_ACCESS,
  buildModuleAccess,
  canAccessModule,
  type ModuleAccess,
} from "@/core/module-access";
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

/**
 * A pessoa está autenticada e na organização, mas o dono da conta não
 * liberou este módulo para ela (ver `core/module-access.ts`).
 */
export class ModuleAccessDeniedError extends Error {
  constructor(message = "Você não tem acesso a este módulo.") {
    super(message);
    this.name = "ModuleAccessDeniedError";
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
  /** Liberado pelo dono da plataforma — ver `organizations.multiUser`. */
  multiUser: boolean;
  /** O que esta pessoa pode abrir — ver `core/module-access.ts`. */
  moduleAccess: ModuleAccess;
}

/**
 * A organização ativa do usuário + seu papel nela.
 *
 * Simplificação do MVP: sem troca de organização (uma pessoa pertence a
 * uma organização só) — pega o primeiro membership (o mais antigo, ordem
 * determinística). Várias pessoas PODEM pertencer à mesma organização
 * (multiusuário — ver `core/team/`); o que não existe é uma pessoa em
 * duas organizações. Trocar isso por uma
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
          multiUser: organizations.multiUser,
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
          multiUser: org.multiUser,
          moduleAccess: FULL_MODULE_ACCESS,
        };
      }
      // Organização foi apagada durante o modo suporte — cai para o
      // fluxo normal abaixo (provavelmente vira NoActiveOrganizationError).
    }

    // Primeiro o membership sozinho, sem join com `organizations`: uma
    // pessoa DESATIVADA (`active = false`) só enxerga a própria linha de
    // `memberships` (policy `memberships_select_self`), nunca a
    // organização — separar as consultas deixa dizer "acesso bloqueado"
    // em vez de "sem organização". `orderBy` torna a escolha
    // determinística caso alguém tenha mais de um membership.
    const [membership] = await tx
      .select({
        id: memberships.id,
        organizationId: memberships.organizationId,
        role: memberships.role,
        membershipActive: memberships.active,
      })
      .from(memberships)
      .where(eq(memberships.userId, user.id))
      .orderBy(asc(memberships.createdAt), asc(memberships.id))
      .limit(1);

    if (!membership) {
      throw new NoActiveOrganizationError();
    }

    if (!membership.membershipActive) {
      throw new OrganizationBlockedError();
    }

    const [org] = await tx
      .select({
        name: organizations.name,
        status: organizations.status,
        primaryColor: organizations.primaryColor,
        sidebarColor: organizations.sidebarColor,
        logoUrl: organizations.logoUrl,
        multiUser: organizations.multiUser,
      })
      .from(organizations)
      .where(eq(organizations.id, membership.organizationId))
      .limit(1);

    if (!org) {
      throw new NoActiveOrganizationError();
    }

    if (org.status === "blocked") {
      throw new OrganizationBlockedError();
    }

    const grantedSlugs =
      membership.role === "owner"
        ? []
        : await tx
            .select({ moduleSlug: membershipModules.moduleSlug })
            .from(membershipModules)
            .where(eq(membershipModules.membershipId, membership.id))
            .then((rows) => rows.map((r) => r.moduleSlug));

    return {
      userId: user.id,
      userEmail: user.email,
      organizationId: membership.organizationId,
      organizationName: org.name,
      role: membership.role,
      impersonating: false,
      organizationStatus: "active", // já teria lançado acima se bloqueada
      primaryColor: org.primaryColor,
      sidebarColor: org.sidebarColor,
      logoUrl: org.logoUrl,
      multiUser: org.multiUser,
      moduleAccess: buildModuleAccess(membership.role, grantedSlugs),
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
  multiUser: boolean;
  moduleAccess: ModuleAccess;
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
    multiUser: context.multiUser,
    moduleAccess: context.moduleAccess,
    log: logger.withContext({
      requestId,
      userId: context.userId,
      organizationId: context.organizationId,
      ...(context.impersonating && { impersonating: true }),
    }),
    withDb: (fn) => runWithUserContext(context.userId, fn),
  };
}

/**
 * `withOrg()` + exige o responsável pela conta (`role === "owner"`). Use em
 * áreas que não são um módulo e que dão visão/ação sobre a empresa inteira
 * (backup, configurações sensíveis) — uma pessoa `staff` de empresa
 * multiusuário nunca deveria baixar um backup com os dados de todos os
 * módulos, mesmo sem ter acesso a nenhum deles.
 */
export async function requireOwner(): Promise<OrgContext> {
  const ctx = await withOrg();
  if (ctx.role !== "owner") {
    ctx.log.warn("auth.somente_responsavel");
    throw new ModuleAccessDeniedError("Só o responsável pela conta acessa esta área.");
  }
  return ctx;
}

/**
 * `withOrg()` + checagem de acesso ao módulo. Use no começo de TODA Server
 * Action, página e rota de um módulo de negócio, no lugar de `withOrg()`:
 *   const { withDb } = await requireModule("ordens");
 * Lança `ModuleAccessDeniedError` quando o dono da conta não liberou o
 * módulo para esta pessoa (o `owner` sempre passa). O menu já esconde o
 * item (`layout.tsx`), mas esconder não é proteção — esta checagem é.
 */
export async function requireModule(slug: string): Promise<OrgContext> {
  const ctx = await withOrg();
  if (!canAccessModule(ctx.moduleAccess, slug)) {
    ctx.log.warn("auth.modulo_negado", { module: slug });
    throw new ModuleAccessDeniedError();
  }
  return ctx;
}

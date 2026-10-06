"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { withOrg } from "@/core/auth";
import { createSupabaseAdminClient } from "@/core/supabase/admin";
import { recordAudit } from "@/core/admin/audit";
import { isPlatformAdmin } from "@/core/platform-admin";
import { getEnabledModulesForOrg } from "@/core/module-settings";
import { expandWithDependencies } from "@/core/module-access";
import { generateTemporaryPassword } from "@/core/temp-password";
import type { ActionResult } from "@/core/action-result";
import { membershipModules, memberships, organizations } from "@/db/schema";
import { parseInviteMemberFormData, parseMemberAccessFormData } from "./validation";
import { findStaffMembership } from "./queries";

/**
 * Ações da tela `/equipe` — só o dono da conta (`role === "owner"`), e só
 * em organização com `multiUser` liberado pelo dono da plataforma. A
 * checagem fica aqui E no banco (policies/triggers em
 * `migrations-custom/0009_multiuser_team.sql`): a Server Action dá a
 * mensagem amigável, o banco impede quem chamar a API por fora.
 */

type TeamOwnerContext = Awaited<ReturnType<typeof withOrg>>;

async function requireTeamOwner(): Promise<
  { ok: true; ctx: TeamOwnerContext } | { ok: false; result: ActionResult }
> {
  const ctx = await withOrg();
  if (ctx.role !== "owner") {
    return {
      ok: false,
      result: { ok: false, message: "Só o responsável pela conta gerencia a equipe." },
    };
  }
  if (!ctx.multiUser) {
    return {
      ok: false,
      result: {
        ok: false,
        message: "O modo com vários usuários não está liberado para esta empresa.",
      },
    };
  }
  return { ok: true, ctx };
}

/** Mensagem + causa (drizzle embrulha o erro do Postgres em `cause`). */
function errorText(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = err.cause instanceof Error ? ` ${err.cause.message}` : "";
  return `${err.message}${cause}`;
}

const SEAT_LIMIT_MESSAGE =
  "Limite de usuários atingido. Desative alguém ou peça ao suporte para ampliar o plano.";

/**
 * Só os módulos que a organização tem habilitados podem ser concedidos, e
 * a lista é fechada sob `dependsOn` (pedidos → clientes etc., ver
 * `core/module-access.ts#expandWithDependencies`) — uma dependência que a
 * organização não tem habilitada simplesmente não entra.
 */
async function filterToEnabledModules(
  ctx: TeamOwnerContext,
  requestedSlugs: string[],
): Promise<string[]> {
  const enabled = await ctx.withDb((db) => getEnabledModulesForOrg(db, ctx.organizationId));
  const allowed = new Set(enabled.map((m) => m.slug));
  return expandWithDependencies(
    requestedSlugs.filter((s) => allowed.has(s)),
    enabled,
  ).filter((s) => allowed.has(s));
}

export interface InviteMemberResult extends ActionResult {
  temporaryPassword?: string;
  email?: string;
}

/**
 * Cria a conta da pessoa (Admin API do Supabase, e-mail já confirmado) com
 * uma senha provisória devolvida UMA vez — o dono da conta repassa por
 * WhatsApp/telefone, igual ao reset do admin. Recusa e-mail que já tem
 * cadastro: aceitar uma conta existente deixaria o dono da conta adicionar
 * (e depois resetar a senha de) alguém que pertence a outra empresa.
 */
export async function inviteMember(
  _prevState: InviteMemberResult,
  formData: FormData,
): Promise<InviteMemberResult> {
  const guard = await requireTeamOwner();
  if (!guard.ok) return guard.result;
  const { ctx } = guard;

  const parsed = parseInviteMemberFormData(formData);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const { email, department } = parsed.data;
  const moduleSlugs = await filterToEnabledModules(ctx, parsed.data.moduleSlugs);

  // Checagem amigável de assento (o trigger do banco é a garantia final).
  const [org] = await ctx.withDb((db) =>
    db
      .select({ seatLimit: organizations.seatLimit })
      .from(organizations)
      .where(eq(organizations.id, ctx.organizationId))
      .limit(1),
  );
  const active = await ctx.withDb((db) =>
    db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.organizationId, ctx.organizationId), eq(memberships.active, true))),
  );
  if (!org || active.length >= org.seatLimit) {
    return { ok: false, message: SEAT_LIMIT_MESSAGE };
  }

  const temporaryPassword = generateTemporaryPassword();
  const supabaseAdmin = createSupabaseAdminClient();
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    app_metadata: { must_change_password: true },
  });

  if (createError || !created?.user) {
    const alreadyExists = /already|registered|exists/i.test(createError?.message ?? "");
    ctx.log.warn("equipe.convidar.usuario_falhou", { email, err: createError });
    return alreadyExists
      ? {
          ok: false,
          errors: {
            email: ["Este e-mail já tem cadastro. Use outro e-mail ou fale com o suporte."],
          },
        }
      : { ok: false, message: "Não foi possível criar o usuário. Tente novamente." };
  }
  const newUserId = created.user.id;

  try {
    await ctx.withDb(async (db) => {
      const [membership] = await db
        .insert(memberships)
        .values({
          userId: newUserId,
          organizationId: ctx.organizationId,
          role: "staff",
          invitedBy: ctx.userId,
          invitedAt: new Date(),
          department,
        })
        .returning({ id: memberships.id });

      if (moduleSlugs.length > 0) {
        await db.insert(membershipModules).values(
          moduleSlugs.map((moduleSlug) => ({
            organizationId: ctx.organizationId,
            membershipId: membership.id,
            moduleSlug,
          })),
        );
      }

      await recordAudit(db, {
        actorUserId: ctx.userId,
        organizationId: ctx.organizationId,
        action: "equipe.convidar",
        metadata: { email, department, moduleSlugs },
      });
    });
  } catch (err) {
    ctx.log.error("equipe.convidar.falhou", { email, err });
    // Não deixa uma conta órfã (sem organização) no Supabase Auth.
    await supabaseAdmin.auth.admin.deleteUser(newUserId).catch((cleanupErr) => {
      ctx.log.error("equipe.convidar.limpeza_falhou", { newUserId, err: cleanupErr });
    });
    return {
      ok: false,
      message: /Limite de usu/i.test(errorText(err))
        ? SEAT_LIMIT_MESSAGE
        : "Não foi possível adicionar a pessoa. Tente novamente.",
    };
  }

  ctx.log.info("equipe.convidar.sucesso", { email });
  revalidatePath("/equipe");
  return { ok: true, temporaryPassword, email };
}

/** Desativa ou reativa uma pessoa da equipe (nunca o dono). Desativar
 * libera o assento e bloqueia o acesso na próxima requisição. */
export async function setMemberActive(
  membershipId: string,
  active: boolean,
): Promise<ActionResult> {
  const guard = await requireTeamOwner();
  if (!guard.ok) return guard.result;
  const { ctx } = guard;

  try {
    const target = await ctx.withDb((db) =>
      findStaffMembership(db, ctx.organizationId, membershipId),
    );
    if (!target) return { ok: false, message: "Pessoa não encontrada." };

    await ctx.withDb(async (db) => {
      await db
        .update(memberships)
        .set({ active })
        .where(
          and(eq(memberships.id, membershipId), eq(memberships.organizationId, ctx.organizationId)),
        );
      await recordAudit(db, {
        actorUserId: ctx.userId,
        organizationId: ctx.organizationId,
        action: active ? "equipe.reativar" : "equipe.desativar",
        metadata: { membershipId, userId: target.userId },
      });
    });

    revalidatePath("/equipe");
    return { ok: true };
  } catch (err) {
    ctx.log.error("equipe.ativar.falhou", { membershipId, active, err });
    return {
      ok: false,
      message: /Limite de usu/i.test(errorText(err))
        ? SEAT_LIMIT_MESSAGE
        : "Não foi possível salvar. Tente novamente.",
    };
  }
}

/** Setor + módulos que a pessoa pode abrir. Substitui a lista inteira. */
export async function setMemberAccess(
  membershipId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await requireTeamOwner();
  if (!guard.ok) return guard.result;
  const { ctx } = guard;

  const parsed = parseMemberAccessFormData(formData);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const { department } = parsed.data;
  const moduleSlugs = await filterToEnabledModules(ctx, parsed.data.moduleSlugs);

  try {
    const target = await ctx.withDb((db) =>
      findStaffMembership(db, ctx.organizationId, membershipId),
    );
    if (!target) return { ok: false, message: "Pessoa não encontrada." };

    await ctx.withDb(async (db) => {
      await db
        .update(memberships)
        .set({ department: department ?? null })
        .where(
          and(eq(memberships.id, membershipId), eq(memberships.organizationId, ctx.organizationId)),
        );

      await db.delete(membershipModules).where(eq(membershipModules.membershipId, membershipId));
      if (moduleSlugs.length > 0) {
        await db.insert(membershipModules).values(
          moduleSlugs.map((moduleSlug) => ({
            organizationId: ctx.organizationId,
            membershipId,
            moduleSlug,
          })),
        );
      }

      await recordAudit(db, {
        actorUserId: ctx.userId,
        organizationId: ctx.organizationId,
        action: "equipe.acesso",
        metadata: { membershipId, userId: target.userId, department, moduleSlugs },
      });
    });

    revalidatePath("/equipe");
    return { ok: true };
  } catch (err) {
    ctx.log.error("equipe.acesso.falhou", { membershipId, err });
    return { ok: false, message: "Não foi possível salvar. Tente novamente." };
  }
}

export interface ResetStaffPasswordResult extends ActionResult {
  temporaryPassword?: string;
}

/** Nova senha provisória para alguém da equipe (esqueceu a senha). */
export async function resetStaffPassword(membershipId: string): Promise<ResetStaffPasswordResult> {
  const guard = await requireTeamOwner();
  if (!guard.ok) return guard.result;
  const { ctx } = guard;

  const target = await ctx.withDb((db) =>
    findStaffMembership(db, ctx.organizationId, membershipId),
  );
  if (!target) return { ok: false, message: "Pessoa não encontrada." };

  // Defesa extra: nunca mexe na senha de quem também é dono da plataforma.
  if (await isPlatformAdmin(target.userId)) {
    return { ok: false, message: "Não foi possível resetar a senha desta pessoa." };
  }

  const temporaryPassword = generateTemporaryPassword();
  const { error } = await createSupabaseAdminClient().auth.admin.updateUserById(target.userId, {
    password: temporaryPassword,
    app_metadata: { must_change_password: true },
  });
  if (error) {
    ctx.log.error("equipe.resetar_senha.falhou", { membershipId, err: error });
    return { ok: false, message: "Não foi possível resetar a senha. Tente novamente." };
  }

  ctx.log.warn("equipe.resetar_senha", { membershipId });
  await ctx.withDb((db) =>
    recordAudit(db, {
      actorUserId: ctx.userId,
      organizationId: ctx.organizationId,
      action: "equipe.senha_resetada",
      metadata: { membershipId, userId: target.userId },
    }),
  );

  return { ok: true, temporaryPassword };
}

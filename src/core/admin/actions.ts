"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/core/admin-auth";
import { createSupabaseAdminClient } from "@/core/supabase/admin";
import { recordAudit } from "./audit";
import { IMPERSONATION_COOKIE, IMPERSONATION_MAX_AGE_SECONDS } from "@/core/impersonation";
import type { ActionResult } from "@/core/action-result";
import {
  auditLog,
  memberships,
  organizationModuleSettings,
  organizations,
  platformAdmins,
} from "@/db/schema";
import {
  parseBillingFormData,
  parseNewOrganizationFormData,
  parseOrganizationNameFormData,
} from "./validation";

/**
 * Modo suporte: o admin passa a acessar `/` (o app) como se fosse o dono
 * da organização escolhida — ver `core/auth.ts#getActiveOrg`. Permitido
 * mesmo se a organização estiver bloqueada (é exatamente quando o suporte
 * mais é necessário).
 */
export async function startImpersonation(organizationId: string) {
  const { userId, log, withDb } = await requireAdmin();

  const org = await withDb(async (db) => {
    const [row] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    return row;
  });

  if (!org) {
    return { ok: false, message: "Organização não encontrada." } satisfies ActionResult;
  }

  log.warn("admin.suporte.iniciar", { organizationId });
  await withDb((db) =>
    recordAudit(db, { actorUserId: userId, organizationId, action: "impersonation.iniciar" }),
  );

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: IMPERSONATION_MAX_AGE_SECONDS,
  });

  redirect("/");
}

/** Sai do modo suporte e volta para a ficha da organização em `/admin`. */
export async function stopImpersonation(organizationId: string) {
  const { userId, log, withDb } = await requireAdmin();
  log.warn("admin.suporte.encerrar", { organizationId });
  await withDb((db) =>
    recordAudit(db, { actorUserId: userId, organizationId, action: "impersonation.encerrar" }),
  );

  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE);

  redirect(`/admin/organizacoes/${organizationId}`);
}

/**
 * Cria uma organização nova + o usuário dono dela (via Admin API do
 * Supabase, já confirmado — sem enviar e-mail). Se o e-mail já existir
 * como usuário do Supabase, reaproveita a conta (mesmo padrão do
 * src/db/seed.ts).
 */
export async function createOrganization(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { userId, log, withDb } = await requireAdmin();

  const parsed = parseNewOrganizationFormData(formData);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const { organizationName, businessType, ownerEmail, ownerPassword } = parsed.data;
  log.info("admin.organizacao.criar", { organizationName, ownerEmail });

  const supabaseAdmin = createSupabaseAdminClient();

  let ownerId: string;
  try {
    const { data: existing, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = existing.users.find((u) => u.email === ownerEmail);
    if (existingUser) {
      ownerId = existingUser.id;
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: ownerEmail,
        password: ownerPassword,
        email_confirm: true,
        // Senha provisória digitada pelo admin — a pessoa é obrigada a
        // trocá-la no primeiro login (ver core/auth.ts#mustChangePassword).
        app_metadata: { must_change_password: true },
      });
      if (error) throw error;
      ownerId = data.user.id;
    }
  } catch (err) {
    log.error("admin.organizacao.criar.usuario_falhou", { ownerEmail, err });
    return { ok: false, message: "Não foi possível criar/localizar o usuário dono." };
  }

  let organizationId: string;
  try {
    organizationId = await withDb(async (db) => {
      const [org] = await db
        .insert(organizations)
        .values({ name: organizationName, businessType })
        .returning({ id: organizations.id });

      await db
        .insert(memberships)
        .values({ userId: ownerId, organizationId: org.id, role: "owner" })
        .onConflictDoNothing();

      log.info("admin.organizacao.criar.sucesso", { organizationId: org.id, ownerId });
      await recordAudit(db, {
        actorUserId: userId,
        organizationId: org.id,
        action: "organizacao.criar",
        metadata: { organizationName, businessType, ownerEmail },
      });

      return org.id;
    });
  } catch (err) {
    log.error("admin.organizacao.criar.falhou", { err });
    return { ok: false, message: "Usuário criado, mas a organização falhou. Tente novamente." };
  }

  revalidatePath("/admin");
  redirect(`/admin/organizacoes/${organizationId}`);
}

/** Bloqueia ou desbloqueia o acesso de TODA a organização (todos os
 * usuários dela param de conseguir entrar — ver core/auth.ts#getActiveOrg). */
export async function setOrganizationStatus(
  organizationId: string,
  status: "active" | "blocked",
): Promise<ActionResult> {
  const { userId, log, withDb } = await requireAdmin();
  log.info("admin.organizacao.status", { organizationId, status });

  try {
    const result = await withDb((db) =>
      db
        .update(organizations)
        .set({ status, updatedAt: new Date() })
        .where(eq(organizations.id, organizationId))
        .returning({ id: organizations.id }),
    );

    if (result.length === 0) {
      return { ok: false, message: "Organização não encontrada." };
    }

    await withDb((db) =>
      recordAudit(db, {
        actorUserId: userId,
        organizationId,
        action: status === "blocked" ? "organizacao.bloquear" : "organizacao.desbloquear",
      }),
    );
    revalidatePath("/admin");
    revalidatePath(`/admin/organizacoes/${organizationId}`);
    return { ok: true };
  } catch (err) {
    log.error("admin.organizacao.status.falhou", { organizationId, err });
    return { ok: false, message: "Não foi possível atualizar o status. Tente novamente." };
  }
}

export async function updateBilling(
  organizationId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { userId, log, withDb } = await requireAdmin();
  log.info("admin.organizacao.cobranca", { organizationId });

  const parsed = parseBillingFormData(formData);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await withDb((db) =>
      db
        .update(organizations)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(organizations.id, organizationId)),
    );

    log.info("admin.organizacao.cobranca.sucesso", { organizationId });
    await withDb((db) =>
      recordAudit(db, {
        actorUserId: userId,
        organizationId,
        action: "organizacao.cobranca",
        metadata: parsed.data,
      }),
    );
    revalidatePath(`/admin/organizacoes/${organizationId}`);
    return { ok: true };
  } catch (err) {
    log.error("admin.organizacao.cobranca.falhou", { organizationId, err });
    return { ok: false, message: "Não foi possível salvar. Tente novamente." };
  }
}

/** O dono da plataforma corrige o nome de uma organização depois de
 * criada — não editável em nenhum outro lugar (o próprio dono da
 * organização não tem essa opção em `/perfil`, só branding). */
export async function updateOrganizationName(
  organizationId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { userId, log, withDb } = await requireAdmin();

  const parsed = parseOrganizationNameFormData(formData);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const updated = await withDb((db) =>
      db
        .update(organizations)
        .set({ name: parsed.data.name, updatedAt: new Date() })
        .where(eq(organizations.id, organizationId))
        .returning({ id: organizations.id }),
    );

    if (updated.length === 0) {
      return { ok: false, message: "Organização não encontrada." };
    }

    log.info("admin.organizacao.renomear", { organizationId, name: parsed.data.name });
    await withDb((db) =>
      recordAudit(db, {
        actorUserId: userId,
        organizationId,
        action: "organizacao.renomear",
        metadata: { name: parsed.data.name },
      }),
    );
    revalidatePath(`/admin/organizacoes/${organizationId}`);
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    log.error("admin.organizacao.renomear.falhou", { organizationId, err });
    return { ok: false, message: "Não foi possível salvar. Tente novamente." };
  }
}

/** Liga/desliga um módulo especificamente para uma organização
 * (personalização — ver core/module-settings.ts). */
export async function setModuleEnabledForOrg(
  organizationId: string,
  moduleSlug: string,
  enabled: boolean,
): Promise<ActionResult> {
  const { userId, log, withDb } = await requireAdmin();
  log.info("admin.organizacao.modulo", { organizationId, moduleSlug, enabled });

  try {
    await withDb((db) =>
      db
        .insert(organizationModuleSettings)
        .values({ organizationId, moduleSlug, enabled })
        .onConflictDoUpdate({
          target: [
            organizationModuleSettings.organizationId,
            organizationModuleSettings.moduleSlug,
          ],
          set: { enabled, updatedAt: new Date() },
        }),
    );

    await withDb((db) =>
      recordAudit(db, {
        actorUserId: userId,
        organizationId,
        action: "organizacao.modulo",
        metadata: { moduleSlug, enabled },
      }),
    );
    revalidatePath(`/admin/organizacoes/${organizationId}`);
    return { ok: true };
  } catch (err) {
    log.error("admin.organizacao.modulo.falhou", { organizationId, moduleSlug, err });
    return { ok: false, message: "Não foi possível salvar. Tente novamente." };
  }
}

/**
 * Apaga uma organização e TODOS os dados dela, sem volta. Exige digitar o
 * nome exato da organização (conferido no servidor, nunca confiando no que
 * o cliente mandou) — a mesma barreira que o GitHub usa para "delete repo".
 *
 * BaseERP não tem módulos de negócio ainda (ver src/modules/README.md),
 * então, diferente do mecano-erp, não há tabelas de negócio (ex.:
 * `customers`/`vehicles`) para apagar em cascata na mão — só as tabelas de
 * fundação abaixo.
 */
export async function hardDeleteOrganization(
  organizationId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { userId, log, withDb } = await requireAdmin();
  log.info("admin.organizacao.apagar_tudo", { organizationId });

  const org = await withDb(async (db) => {
    const [row] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    return row;
  });

  if (!org) {
    return { ok: false, message: "Organização não encontrada." };
  }

  const confirmName = String(formData.get("confirmName") ?? "").trim();
  if (confirmName !== org.name) {
    log.warn("admin.organizacao.apagar_tudo.confirmacao_invalida", { organizationId });
    return {
      ok: false,
      errors: { confirmName: [`Digite exatamente "${org.name}" para confirmar.`] },
    };
  }

  // Precisa ser lido ANTES de apagar `memberships` na transação abaixo —
  // são os e-mails do Supabase Auth que também vão embora (ver comentário
  // mais abaixo, perto do loop de `deleteUser`).
  const memberUserIds = await withDb((db) =>
    db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(eq(memberships.organizationId, organizationId))
      .then((rows) => rows.map((r) => r.userId)),
  );

  try {
    await withDb(async (db) => {
      await db.transaction(async (tx) => {
        await tx
          .delete(organizationModuleSettings)
          .where(eq(organizationModuleSettings.organizationId, organizationId));
        await tx.delete(memberships).where(eq(memberships.organizationId, organizationId));
        await tx.delete(organizations).where(eq(organizations.id, organizationId));
      });
    });

    log.info("admin.organizacao.apagar_tudo.sucesso", { organizationId, name: org.name });
    // organizationId sem valor: a organização já não existe mais (FK
    // aponta para null nesse caso). O nome/id ficam gravados em metadata.
    await withDb((db) =>
      recordAudit(db, {
        actorUserId: userId,
        organizationId: null,
        action: "organizacao.apagar_tudo",
        metadata: { organizationId, name: org.name },
      }),
    );
  } catch (err) {
    log.error("admin.organizacao.apagar_tudo.falhou", { organizationId, err });
    return { ok: false, message: "Não foi possível apagar. Tente novamente." };
  }

  // Apaga também a conta de autenticação de cada pessoa que só
  // pertencia a esta organização (MVP: uma pessoa pertence a uma
  // organização só — ver core/auth.ts#getActiveOrg) — senão "apagar
  // todos os dados" deixava o e-mail/senha da pessoa presos no Supabase
  // Auth pra sempre, sem nenhuma organização que os use. Melhor esforço:
  // os dados da organização já foram apagados de verdade (irreversível)
  // acima, então uma falha aqui só fica registrada no log, nunca desfaz
  // o que já aconteceu. Nunca apaga quem também é platform admin.
  const supabaseAdmin = createSupabaseAdminClient();
  for (const memberUserId of memberUserIds) {
    try {
      const [adminRow] = await withDb((db) =>
        db
          .select({ userId: platformAdmins.userId })
          .from(platformAdmins)
          .where(eq(platformAdmins.userId, memberUserId))
          .limit(1),
      );
      if (adminRow) continue;

      const { error } = await supabaseAdmin.auth.admin.deleteUser(memberUserId);
      if (error) throw error;
      log.info("admin.organizacao.apagar_tudo.usuario_removido", { memberUserId });
    } catch (err) {
      log.error("admin.organizacao.apagar_tudo.usuario_falhou", { memberUserId, err });
    }
  }

  revalidatePath("/admin");
  redirect("/admin");
}

/** Apaga uma única linha do histórico de auditoria da organização. */
export async function deleteAuditLogEntry(
  entryId: string,
  organizationId: string,
): Promise<ActionResult> {
  const { log, withDb } = await requireAdmin();

  try {
    await withDb((db) => db.delete(auditLog).where(eq(auditLog.id, entryId)));
    log.info("admin.auditoria.apagar_entrada", { entryId, organizationId });
    revalidatePath(`/admin/organizacoes/${organizationId}`);
    return { ok: true };
  } catch (err) {
    log.error("admin.auditoria.apagar_entrada.falhou", { entryId, err });
    return { ok: false, message: "Não foi possível apagar. Tente novamente." };
  }
}

/** Apaga todo o histórico de auditoria de uma organização. */
export async function clearAuditLogForOrg(organizationId: string): Promise<ActionResult> {
  const { log, withDb } = await requireAdmin();

  try {
    await withDb((db) => db.delete(auditLog).where(eq(auditLog.organizationId, organizationId)));
    log.info("admin.auditoria.limpar", { organizationId });
    revalidatePath(`/admin/organizacoes/${organizationId}`);
    return { ok: true };
  } catch (err) {
    log.error("admin.auditoria.limpar.falhou", { organizationId, err });
    return { ok: false, message: "Não foi possível limpar o histórico. Tente novamente." };
  }
}

/** Letras/dígitos sem caracteres ambíguos (0/O, 1/l/I) — pensado pra ser
 * digitado/ditado por telefone quando o admin repassa pro usuário. */
const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function generateTemporaryPassword(length = 12): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => TEMP_PASSWORD_ALPHABET[b % TEMP_PASSWORD_ALPHABET.length]).join(
    "",
  );
}

export interface ResetMemberPasswordResult extends ActionResult {
  temporaryPassword?: string;
}

/**
 * Reset de senha pelo dono da plataforma: gera uma senha provisória
 * aleatória e grava direto via Admin API do Supabase (nunca precisa da
 * senha antiga) — devolvida UMA vez na resposta da action, pra quem
 * chamou mostrar na tela e repassar pro usuário (WhatsApp, telefone,
 * etc; este sistema não manda e-mail próprio nenhum). Marca
 * `must_change_password` para forçar a troca no próximo login (ver
 * core/auth.ts#mustChangePassword) — os dados que a pessoa já tinha
 * cadastrado na organização não são tocados, só a senha dela no
 * Supabase Auth.
 */
export async function resetMemberPassword(
  organizationId: string,
  userId: string,
): Promise<ResetMemberPasswordResult> {
  const { userId: actorUserId, log, withDb } = await requireAdmin();

  const temporaryPassword = generateTemporaryPassword();
  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: temporaryPassword,
    app_metadata: { must_change_password: true },
  });

  if (error) {
    log.error("admin.usuario.resetar_senha.falhou", { organizationId, userId, err: error });
    return { ok: false, message: "Não foi possível resetar a senha. Tente novamente." };
  }

  log.warn("admin.usuario.resetar_senha", { organizationId, userId });
  await withDb((db) =>
    recordAudit(db, {
      actorUserId,
      organizationId,
      action: "usuario.senha_resetada",
      metadata: { userId },
    }),
  );

  return { ok: true, temporaryPassword };
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { withOrg } from "@/core/auth";
import { createSupabaseServerClient } from "@/core/supabase/server";
import { createSupabaseAdminClient } from "@/core/supabase/admin";
import { organizations } from "@/db/schema";
import type { ActionResult } from "@/core/action-result";

const displayNameSchema = z.object({
  displayName: z.string().trim().min(1, "Informe um nome.").max(120, "Nome muito longo."),
});

/** Preferência pessoal — cada pessoa edita a própria, sem checagem de
 * organização (não é um dado de tenancy). */
export async function updateDisplayName(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = displayNameSchema.safeParse({ displayName: formData.get("displayName") });
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    data: { display_name: parsed.data.displayName },
  });

  if (error) {
    return { ok: false, message: "Não foi possível salvar o nome. Tente novamente." };
  }

  revalidatePath("/perfil");
  return { ok: true };
}

const passwordSchema = z
  .object({
    password: z.string().min(6, "Mínimo de 6 caracteres."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

/**
 * Troca a senha da sessão atual e, em seguida, zera
 * `app_metadata.must_change_password` — só o Admin API (service role)
 * pode gravar `app_metadata`, o próprio usuário não consegue (por isso
 * não basta o `updateUser` acima). Compartilhado pelas duas telas que
 * trocam senha: a obrigatória (`changeMandatoryPassword`) e a de dentro
 * do Perfil (`changeOwnPassword`).
 */
async function setNewPassword(formData: FormData): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Sessão expirada — faça login novamente." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { ok: false, message: "Não foi possível trocar a senha. Tente novamente." };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  await supabaseAdmin.auth.admin.updateUserById(user.id, {
    app_metadata: { must_change_password: false },
  });

  return { ok: true };
}

/** Tela `/trocar-senha-obrigatoria` — libera o acesso ao resto do
 * sistema ao terminar (ver gate em `app/(app)/layout.tsx` e
 * `app/(admin)/admin/layout.tsx`). */
export async function changeMandatoryPassword(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const result = await setNewPassword(formData);
  if (!result.ok) return result;
  redirect("/");
}

/** Troca de senha voluntária, feita de dentro do Perfil. */
export async function changeOwnPassword(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return setNewPassword(formData);
}

const hexColorField = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor no formato hexadecimal, ex.: #2563eb.")
  .optional()
  .or(z.literal("").transform(() => undefined));

const brandingSchema = z.object({
  primaryColor: hexColorField,
  sidebarColor: hexColorField,
});

const LOGO_BUCKET = "branding";
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;

async function ensureLogoBucket(supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>) {
  // Idempotente: o bucket é criado na primeira vez que alguém sobe um
  // logo — nenhum dos projetos-irmãos usa Supabase Storage ainda, não há
  // passo manual de setup para isso em nenhum README.
  const { error } = await supabaseAdmin.storage.createBucket(LOGO_BUCKET, {
    public: true,
    fileSizeLimit: MAX_LOGO_SIZE_BYTES,
  });
  if (error && !error.message.toLowerCase().includes("already exists")) {
    throw error;
  }
}

/**
 * Branding da organização (cor + logo) — só quem tem `role === "owner"`
 * pode editar (checagem feita aqui, não em RLS separada de Storage: o
 * upload roda com o client admin/service role depois desta checagem,
 * mesmo padrão de permissão-na-action usado no resto de `core/admin`).
 */
export async function updateOrganizationBranding(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { organizationId, role, log, withDb } = await withOrg();

  if (role !== "owner") {
    return { ok: false, message: "Só o dono da organização pode alterar a aparência do sistema." };
  }

  const rawPrimaryColor = formData.get("primaryColor");
  const rawSidebarColor = formData.get("sidebarColor");
  const parsed = brandingSchema.safeParse({
    primaryColor: rawPrimaryColor,
    sidebarColor: rawSidebarColor,
  });
  // TODO(temporário): as cores estavam chegando nulas no banco mesmo
  // depois de escolhidas — este log mostra o valor bruto recebido do
  // form pra diagnosticar se o problema é no cliente (valor nunca
  // chega) ou no parse/persistência (chega, mas não é gravado). Remover
  // depois de confirmar a causa (ver docs/decisoes.md).
  log.info("perfil.branding.form_recebido", {
    rawPrimaryColor,
    rawSidebarColor,
    parsedOk: parsed.success,
    parsedErrors: parsed.success ? undefined : parsed.error.flatten().fieldErrors,
  });
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }

  const logoFile = formData.get("logo");
  const supabaseAdmin = createSupabaseAdminClient();

  let logoUrl: string | undefined;
  if (logoFile instanceof File && logoFile.size > 0) {
    if (logoFile.size > MAX_LOGO_SIZE_BYTES) {
      return { ok: false, errors: { logo: ["Imagem muito grande (máximo 2 MB)."] } };
    }

    try {
      await ensureLogoBucket(supabaseAdmin);
    } catch (err) {
      log.error("perfil.branding.bucket_falhou", { err });
      return { ok: false, message: "Não foi possível preparar o armazenamento do logo." };
    }

    const extension = logoFile.name.includes(".") ? logoFile.name.split(".").pop() : "png";
    const path = `${organizationId}/logo.${extension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(LOGO_BUCKET)
      .upload(path, logoFile, { upsert: true, contentType: logoFile.type || undefined });

    if (uploadError) {
      log.error("perfil.branding.upload_falhou", { err: uploadError });
      return { ok: false, message: "Não foi possível enviar o logo. Tente novamente." };
    }

    const { data: publicUrl } = supabaseAdmin.storage.from(LOGO_BUCKET).getPublicUrl(path);
    // Evita cache de CDN mostrando o logo antigo depois de trocar.
    logoUrl = `${publicUrl.publicUrl}?v=${Date.now()}`;
  }

  const setValues = {
    primaryColor: parsed.data.primaryColor ?? null,
    sidebarColor: parsed.data.sidebarColor ?? null,
    ...(logoUrl && { logoUrl }),
    updatedAt: new Date(),
  };
  log.info("perfil.branding.set_values", { setValues });

  const updated = await withDb((db) =>
    db.update(organizations).set(setValues).where(eq(organizations.id, organizationId)).returning({
      id: organizations.id,
      primaryColor: organizations.primaryColor,
      sidebarColor: organizations.sidebarColor,
    }),
  );
  log.info("perfil.branding.returning", { updated });

  // Nunca reportar sucesso sem checar isto: com RLS ativa, uma policy
  // que não libere a escrita bloqueia silenciosamente (0 linhas
  // afetadas, sem erro nenhum) — foi exatamente o bug que existiu aqui
  // antes da policy/trigger de owner em migrations-custom (ver
  // docs/decisoes.md).
  if (updated.length === 0) {
    log.error("perfil.branding.sem_permissao", { organizationId });
    return {
      ok: false,
      message:
        "Não foi possível salvar — você pode não ter permissão para alterar esta organização.",
    };
  }

  log.info("perfil.branding.atualizar", { organizationId });
  revalidatePath("/", "layout");
  revalidatePath("/perfil");
  return { ok: true };
}

/** Compartilhado pelos dois botões "Restaurar padrão" (cor de destaque e
 * cor do menu lateral) — zera só a coluna pedida, mesma checagem de
 * permissão de `updateOrganizationBranding`. */
async function resetBrandingColorColumn(
  column: "primaryColor" | "sidebarColor",
  logLabel: string,
): Promise<ActionResult> {
  const { organizationId, role, log, withDb } = await withOrg();

  if (role !== "owner") {
    return { ok: false, message: "Só o dono da organização pode alterar a aparência do sistema." };
  }

  const updated = await withDb((db) =>
    db
      .update(organizations)
      .set({ [column]: null, updatedAt: new Date() })
      .where(eq(organizations.id, organizationId))
      .returning({ id: organizations.id }),
  );

  if (updated.length === 0) {
    log.error("perfil.branding.sem_permissao", { organizationId });
    return {
      ok: false,
      message:
        "Não foi possível salvar — você pode não ter permissão para alterar esta organização.",
    };
  }

  log.info(logLabel, { organizationId });
  revalidatePath("/", "layout");
  revalidatePath("/perfil");
  return { ok: true };
}

/** Volta a cor de destaque (botões) pro padrão do sistema — o logo e a
 * cor do menu lateral não são afetados. */
export async function resetOrganizationColor(): Promise<ActionResult> {
  return resetBrandingColorColumn("primaryColor", "perfil.branding.resetar_cor");
}

/** Volta a cor do menu lateral pro padrão do sistema — o logo e a cor
 * de destaque não são afetados. */
export async function resetSidebarColor(): Promise<ActionResult> {
  return resetBrandingColorColumn("sidebarColor", "perfil.branding.resetar_cor_lateral");
}

/** Remove o logo customizado — volta a mostrar a marca oficial do
 * sistema (ícone + nome) no lugar. Apaga também o objeto no Storage
 * (não só o ponteiro no banco), pra não deixar arquivo órfão. */
export async function resetOrganizationLogo(): Promise<ActionResult> {
  const { organizationId, role, log, withDb } = await withOrg();

  if (role !== "owner") {
    return { ok: false, message: "Só o dono da organização pode alterar a aparência do sistema." };
  }

  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const { data: files } = await supabaseAdmin.storage.from(LOGO_BUCKET).list(organizationId);
    if (files && files.length > 0) {
      await supabaseAdmin.storage
        .from(LOGO_BUCKET)
        .remove(files.map((f) => `${organizationId}/${f.name}`));
    }
  } catch (err) {
    // Não bloqueia a remoção do ponteiro no banco por causa disso — na
    // pior hipótese fica um arquivo órfão no bucket, não um bug visível
    // pra quem usa o sistema.
    log.error("perfil.branding.logo_storage_falhou", { err });
  }

  const updated = await withDb((db) =>
    db
      .update(organizations)
      .set({ logoUrl: null, updatedAt: new Date() })
      .where(eq(organizations.id, organizationId))
      .returning({ id: organizations.id }),
  );

  if (updated.length === 0) {
    log.error("perfil.branding.sem_permissao", { organizationId });
    return {
      ok: false,
      message:
        "Não foi possível salvar — você pode não ter permissão para alterar esta organização.",
    };
  }

  log.info("perfil.branding.resetar_logo", { organizationId });
  revalidatePath("/", "layout");
  revalidatePath("/perfil");
  return { ok: true };
}

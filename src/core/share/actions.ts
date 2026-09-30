"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { withOrg } from "@/core/auth";
import type { ActionResult } from "@/core/action-result";
import { encryptSecret } from "@/core/crypto";
import { organizationEmailSettings, sharedDocuments } from "@/db/schema";
import { shareDocumentSchema, SHARE_KIND_LABELS } from "./document";
import { isAllowedSmtpHost, sendSmtpMail, verifySmtp } from "./email";
import { renderSharePdf } from "./pdf";

const sendSchema = z.object({
  shareId: z.uuid(),
  to: z.email("E-mail inválido."),
  message: z.string().trim().min(1).max(2000),
});

/** Envia o documento por e-mail (PDF anexo) usando o SMTP configurado da organização. */
export async function sendShareByEmail(input: {
  shareId: string;
  to: string;
  message: string;
}): Promise<ActionResult> {
  const { organizationId, log, withDb } = await withOrg();
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Informe um e-mail válido." };

  const [cfg, share] = await withDb(async (tx) => [
    (
      await tx
        .select()
        .from(organizationEmailSettings)
        .where(
          and(
            eq(organizationEmailSettings.organizationId, organizationId),
            eq(organizationEmailSettings.enabled, true),
          ),
        )
        .limit(1)
    )[0],
    (
      await tx
        .select()
        .from(sharedDocuments)
        .where(
          and(
            eq(sharedDocuments.id, parsed.data.shareId),
            eq(sharedDocuments.organizationId, organizationId),
          ),
        )
        .limit(1)
    )[0],
  ]);
  if (!cfg) return { ok: false, message: "O envio de e-mail pelo sistema não está configurado." };
  if (!share) return { ok: false, message: "Documento não encontrado." };

  const doc = shareDocumentSchema.safeParse(share.payload);
  if (!doc.success) return { ok: false, message: "Documento inválido." };

  try {
    const pdf = await renderSharePdf(doc.data);
    const label = `${SHARE_KIND_LABELS[doc.data.kind]}${doc.data.number ? ` nº ${doc.data.number}` : ""}`;
    await sendSmtpMail(cfg, {
      to: parsed.data.to,
      replyTo: cfg.fromEmail,
      subject: `${label} — ${doc.data.issuerName}`,
      text: parsed.data.message,
      attachment: {
        filename: `${label.replace(/[^\w.-]+/g, "_")}.pdf`,
        content: pdf,
      },
    });
  } catch (err) {
    log.warn("share.email.falhou", {
      shareId: share.id,
      err: err instanceof Error ? err.message : "?",
    });
    return {
      ok: false,
      message: "Não foi possível enviar o e-mail. Confira a configuração de e-mail em Perfil.",
    };
  }

  await withDb((tx) =>
    tx
      .update(sharedDocuments)
      .set({ emailSentAt: new Date() })
      .where(eq(sharedDocuments.id, share.id)),
  );
  log.info("share.email.enviado", { shareId: share.id });
  return { ok: true };
}

/** Revoga um link (deixa de abrir na hora). */
export async function revokeShare(shareId: string): Promise<ActionResult> {
  const { organizationId, withDb } = await withOrg();
  await withDb((tx) =>
    tx
      .update(sharedDocuments)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(sharedDocuments.id, shareId), eq(sharedDocuments.organizationId, organizationId)),
      ),
  );
  return { ok: true };
}

const emailSettingsSchema = z.object({
  host: z.string().trim().min(3, "Informe o servidor SMTP."),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string().trim().min(1, "Informe o usuário."),
  password: z.string().optional(),
  fromName: z.string().trim().optional(),
  fromEmail: z.email("E-mail de envio inválido."),
});

/** Salva/atualiza a configuração SMTP (só o dono da organização). Senha vazia mantém a atual. */
export async function saveEmailSettings(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { organizationId, role, log, withDb } = await withOrg();
  if (role !== "owner") {
    return { ok: false, message: "Só o responsável pela conta pode configurar o e-mail." };
  }

  const parsed = emailSettingsSchema.safeParse({
    host: formData.get("host"),
    port: formData.get("port"),
    secure: formData.get("secure") === "on",
    username: formData.get("username"),
    password: formData.get("password") || undefined,
    fromName: formData.get("fromName") || undefined,
    fromEmail: formData.get("fromEmail"),
  });
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  if (!isAllowedSmtpHost(parsed.data.host)) {
    return { ok: false, errors: { host: ["Use o endereço público do servidor de e-mail."] } };
  }

  const [existing] = await withDb((tx) =>
    tx
      .select({ passwordEncrypted: organizationEmailSettings.passwordEncrypted })
      .from(organizationEmailSettings)
      .where(eq(organizationEmailSettings.organizationId, organizationId))
      .limit(1),
  );
  if (!parsed.data.password && !existing) {
    return { ok: false, errors: { password: ["Informe a senha (ou senha de aplicativo)."] } };
  }

  let passwordEncrypted: string;
  try {
    passwordEncrypted = parsed.data.password
      ? encryptSecret(parsed.data.password)
      : existing.passwordEncrypted;
  } catch {
    log.error("share.email.config_sem_chave");
    return {
      ok: false,
      message:
        "O servidor não está preparado para guardar senhas (chave de criptografia ausente). Fale com o suporte.",
    };
  }

  const values = {
    enabled: true,
    host: parsed.data.host,
    port: parsed.data.port,
    secure: parsed.data.secure,
    username: parsed.data.username,
    passwordEncrypted,
    fromName: parsed.data.fromName ?? null,
    fromEmail: parsed.data.fromEmail,
    updatedAt: new Date(),
  };
  await withDb((tx) =>
    tx
      .insert(organizationEmailSettings)
      .values({ organizationId, ...values })
      .onConflictDoUpdate({ target: organizationEmailSettings.organizationId, set: values }),
  );
  log.info("share.email.config_salva");
  revalidatePath("/perfil/email");
  return { ok: true };
}

/** Testa a conexão SMTP salva sem enviar e-mail. */
export async function testEmailSettings(): Promise<ActionResult> {
  const { organizationId, withDb } = await withOrg();
  const [cfg] = await withDb((tx) =>
    tx
      .select()
      .from(organizationEmailSettings)
      .where(eq(organizationEmailSettings.organizationId, organizationId))
      .limit(1),
  );
  if (!cfg) return { ok: false, message: "Salve a configuração primeiro." };
  try {
    await verifySmtp(cfg);
    return { ok: true, message: "Conexão OK." };
  } catch {
    return {
      ok: false,
      message: "Não foi possível conectar. Confira servidor, porta, usuário e senha.",
    };
  }
}

/** Remove a configuração (volta a usar só WhatsApp/link/mailto). */
export async function removeEmailSettings(): Promise<ActionResult> {
  const { organizationId, role, withDb } = await withOrg();
  if (role !== "owner") return { ok: false, message: "Só o responsável pela conta pode alterar." };
  await withDb((tx) =>
    tx
      .delete(organizationEmailSettings)
      .where(eq(organizationEmailSettings.organizationId, organizationId)),
  );
  revalidatePath("/perfil/email");
  return { ok: true };
}

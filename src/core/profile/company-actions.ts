"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { withOrg } from "@/core/auth";
import type { ActionResult } from "@/core/action-result";
import { isValidDocument } from "@/core/document";
import { organizations } from "@/db/schema";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .optional()
    .transform((v) => v || null);

/** Dados da empresa que saem nos documentos enviados ao cliente. */
export const companyProfileSchema = z.object({
  displayName: optional(120),
  document: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .refine((v) => !v || isValidDocument(v), "CPF/CNPJ inválido."),
  phone: optional(30),
  address: optional(200),
});

export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;

/**
 * Só o dono da conta (`role === "owner"`) edita. O banco também protege:
 * o gatilho `restrict_organization_branding_update` continua bloqueando
 * nome da conta, status e cobrança (só o dono da plataforma).
 */
export async function updateCompanyProfile(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { organizationId, role, log, withDb } = await withOrg();
  if (role !== "owner") {
    return { ok: false, message: "Só o responsável pela conta pode alterar estes dados." };
  }

  const parsed = companyProfileSchema.safeParse({
    displayName: formData.get("displayName") ?? undefined,
    document: formData.get("document") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    address: formData.get("address") ?? undefined,
  });
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  const { displayName, document, phone, address } = parsed.data;
  await withDb((tx) =>
    tx
      .update(organizations)
      .set({
        displayName,
        document: document ? document.replace(/\D/g, "") : null,
        phone,
        address,
      })
      .where(eq(organizations.id, organizationId)),
  );

  log.info("perfil.empresa.atualizar");
  revalidatePath("/perfil");
  return { ok: true };
}

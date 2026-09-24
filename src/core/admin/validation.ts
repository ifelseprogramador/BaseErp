import { z } from "zod";

export const billingSchema = z.object({
  billingStatus: z.enum(["em_dia", "atrasado", "cancelado"]),
  nextDueDate: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined),
  billingNotes: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined),
});

export function parseBillingFormData(formData: FormData) {
  return billingSchema.safeParse({
    billingStatus: formData.get("billingStatus"),
    nextDueDate: formData.get("nextDueDate"),
    billingNotes: formData.get("billingNotes"),
  });
}

export const newOrganizationSchema = z.object({
  organizationName: z.string().trim().min(2, "Informe o nome da organização."),
  // Preset informativo de ramo de negócio — ver comentário em
  // `db/schema/tenancy.ts#organizations.businessType`. Texto livre e
  // opcional, nunca lido por nenhum módulo.
  businessType: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined),
  ownerEmail: z.email("E-mail inválido."),
  ownerPassword: z.string().min(6, "Mínimo de 6 caracteres."),
});

export function parseNewOrganizationFormData(formData: FormData) {
  return newOrganizationSchema.safeParse({
    organizationName: formData.get("organizationName"),
    businessType: formData.get("businessType"),
    ownerEmail: formData.get("ownerEmail"),
    ownerPassword: formData.get("ownerPassword"),
  });
}

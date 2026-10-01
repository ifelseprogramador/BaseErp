import { z } from "zod";
import { isValidDocument } from "@/core/document";

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

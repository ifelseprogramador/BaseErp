import { z } from "zod";

const departmentField = z
  .string()
  .trim()
  .max(60, "Setor muito longo (máximo 60 caracteres).")
  .optional()
  .transform((v) => v || undefined);

const moduleSlugsField = z.array(z.string().trim().min(1)).transform((v) => Array.from(new Set(v)));

export const inviteMemberSchema = z.object({
  email: z.email("E-mail inválido.").transform((v) => v.toLowerCase()),
  department: departmentField,
  moduleSlugs: moduleSlugsField,
});

export function parseInviteMemberFormData(formData: FormData) {
  return inviteMemberSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    department: formData.get("department") ?? undefined,
    moduleSlugs: formData.getAll("moduleSlugs").map(String),
  });
}

export const memberAccessSchema = z.object({
  department: departmentField,
  moduleSlugs: moduleSlugsField,
});

export function parseMemberAccessFormData(formData: FormData) {
  return memberAccessSchema.safeParse({
    department: formData.get("department") ?? undefined,
    moduleSlugs: formData.getAll("moduleSlugs").map(String),
  });
}

/** Limite de usuários e modo multiusuário — só o dono da plataforma altera. */
export const seatsSchema = z
  .object({
    multiUser: z.boolean(),
    seatLimit: z
      .number({ error: "Informe o limite de usuários." })
      .int("Informe um número inteiro.")
      .min(1, "Mínimo de 1 usuário.")
      .max(500, "Máximo de 500 usuários."),
    extraSeatPriceCents: z.number().int().min(0, "Valor inválido.").nullable(),
  })
  .refine((v) => v.multiUser || v.seatLimit === 1, {
    message: "No modo de um usuário só, o limite é 1.",
    path: ["seatLimit"],
  });

/** "29,90" / "1.029,90" / "" → centavos, ou `null` quando vazio; `NaN` se inválido. */
export function parsePriceToCents(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const normalized = text.replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return Number.NaN;
  return Math.round(value * 100);
}

export function parseSeatsFormData(formData: FormData) {
  const price = parsePriceToCents(String(formData.get("extraSeatPrice") ?? ""));
  const multiUser = formData.get("multiUser") === "on";
  const rawLimit = String(formData.get("seatLimit") ?? "").trim();
  return seatsSchema.safeParse({
    multiUser,
    // Desligado: o campo de limite pode vir vazio/desabilitado — vale 1.
    seatLimit: multiUser ? (rawLimit === "" ? Number.NaN : Number(rawLimit)) : 1,
    extraSeatPriceCents: Number.isNaN(price) ? -1 : price,
  });
}

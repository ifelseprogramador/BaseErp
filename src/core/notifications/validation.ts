import { z } from "zod";

/** Valor do `<Select>` quando a notificação é pra todas as organizações —
 * "" não é um valor válido de `SelectItem` no Base UI. */
export const ALL_ORGANIZATIONS = "__all__";

export const NOTIFICATION_CATEGORIES = ["aviso", "novidade", "dica"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const notificationSchema = z.object({
  title: z.string().trim().min(1, "Informe um título."),
  body: z.string().trim().min(1, "Informe a mensagem."),
  category: z.enum(NOTIFICATION_CATEGORIES).default("aviso"),
  // undefined = pra todas as organizações (organization_id nulo no banco).
  organizationId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== ALL_ORGANIZATIONS ? v : undefined)),
});

export type NotificationInput = z.infer<typeof notificationSchema>;

export function parseNotificationFormData(formData: FormData) {
  return notificationSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    category: formData.get("category") ?? undefined,
    organizationId: formData.get("organizationId"),
  });
}

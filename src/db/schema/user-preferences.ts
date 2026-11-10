import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import type { UiMode } from "@/core/ui-mode";

/**
 * Preferências pessoais de interface — uma linha por pessoa (a escolha
 * acompanha quem entrou, em qualquer aparelho). Sem FK para `auth.users`
 * e sem `organization_id`: não é dado de tenancy. A RLS deixa cada pessoa
 * ler e gravar só a própria linha (migrations-custom/0014_user_preferences_rls.sql).
 * Sem linha, vale o padrão `formal` (ver `core/ui-mode.ts`).
 */
export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id").primaryKey(),
  uiMode: text("ui_mode").$type<UiMode>().notNull().default("formal"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

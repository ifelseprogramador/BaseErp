import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * Configurações GLOBAIS da plataforma, editadas só pelo dono (`/admin`).
 * Uma única linha (`id = 'singleton'`, criada pela migration). Leitura
 * liberada a qualquer usuário autenticado — são números sem segredo, e o
 * "Chamar suporte" precisa saber quanto esperar; escrita só do admin (RLS em
 * migrations-custom). Segredos (token do Telegram) NÃO ficam aqui: vão em
 * variáveis de ambiente.
 */
export const platformSettings = pgTable("platform_settings", {
  id: text("id").primaryKey().default("singleton"),
  // Quanto o usuário espera por um atendente antes de o pedido virar
  // "perdida" e o dono ser avisado pelo Telegram (5–300 s).
  supportWaitSeconds: integer("support_wait_seconds").notNull().default(30),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

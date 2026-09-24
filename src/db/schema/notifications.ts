import { pgTable, pgEnum, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { organizations } from "./tenancy";

/** "aviso" (exige atenção), "novidade" (funcionalidade nova) ou "dica"
 * (sugestão de uso) — o ícone/cor no sino do usuário varia por categoria. */
export const notificationCategoryEnum = pgEnum("notification_category", [
  "aviso",
  "novidade",
  "dica",
]);

/**
 * Avisos que o dono da plataforma manda para as organizações — não é um
 * módulo plugável de negócio, é operação da plataforma (mesma categoria
 * de `core/admin/` e `live-support`). Vive em `db/schema/` (fundação) em
 * vez de `modules/`.
 *
 * `organizationId` nulo = para TODAS as organizações; preenchido = só
 * para uma. `createdBy` é o id do admin (auth.users, fora do schema do
 * Drizzle — mesmo padrão de `memberships.userId`).
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    category: notificationCategoryEnum("category").notNull().default("aviso"),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("notifications_organization_id_idx").on(table.organizationId)],
);

/**
 * Quem leu — por pessoa (`userId`, não por organização inteira).
 * `dismissedAt`: a pessoa apagou do próprio sino (a notificação em si não
 * some, só deixa de aparecer para ela).
 */
export const notificationReads = pgTable(
  "notification_reads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("notification_reads_unique").on(table.notificationId, table.userId),
    index("notification_reads_notification_id_idx").on(table.notificationId),
  ],
);

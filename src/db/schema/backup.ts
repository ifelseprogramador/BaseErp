import { pgTable, uuid, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { organizations } from "./tenancy";

/**
 * Uma linha por organização — se não existir linha, o padrão é backup
 * automático LIGADO (`getAutoBackupEnabled()` em `core/backup.ts` trata
 * "sem linha" como `true`; só grava linha quando alguém desliga).
 */
export const organizationBackupSettings = pgTable("organization_backup_settings", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  autoBackupEnabled: boolean("auto_backup_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Snapshots diários gerados pelo cron (`api/cron/backup/route.ts`) — mesmo
 * formato JSON de `GET /backup/exportar` (ver `core/backup.ts`), guardado
 * no próprio Postgres. Podado para manter só os últimos N por organização
 * (`AUTO_BACKUP_RETENTION` em `core/backup.ts`).
 */
export const organizationBackups = pgTable(
  "organization_backups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("organization_backups_org_id_idx").on(table.organizationId, table.createdAt)],
);

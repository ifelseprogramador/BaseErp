import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./tenancy";

/**
 * Snapshot de um documento enviado ao cliente por link público
 * (`/d/<token>`). Guarda só o HASH (sha256) do token — o link completo nunca
 * fica no banco. A leitura pública NÃO passa pela RLS: usa a função
 * `public.get_shared_document(hash)` (SECURITY DEFINER, ver
 * migrations-custom/0007_sharing_rls.sql), que só devolve documento não
 * expirado e não revogado. Contém dado pessoal do cliente: por isso expira
 * (padrão 30 dias) e pode ser revogado.
 */
export const sharedDocuments = pgTable(
  "shared_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    payload: jsonb("payload").notNull(),
    recipientName: text("recipient_name"),
    recipientPhone: text("recipient_phone"),
    recipientEmail: text("recipient_email"),
    // Referência solta ao registro de origem (ex.: id do pedido) — sem FK.
    sourceType: text("source_type"),
    sourceId: text("source_id"),
    createdBy: uuid("created_by"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    firstViewedAt: timestamp("first_viewed_at", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),
    emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("shared_documents_organization_id_idx").on(table.organizationId),
    index("shared_documents_source_idx").on(table.organizationId, table.sourceType, table.sourceId),
    index("shared_documents_expires_at_idx").on(table.expiresAt),
  ],
);

/**
 * Configuração OPCIONAL de envio de e-mail direto (SMTP) por organização.
 * Sem linha (ou `enabled = false`) o botão de envio cai no `mailto:`/link.
 * A senha é SEMPRE criptografada (`core/crypto.ts`) e nunca volta ao cliente.
 */
export const organizationEmailSettings = pgTable("organization_email_settings", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(true),
  host: text("host").notNull(),
  port: integer("port").notNull().default(587),
  secure: boolean("secure").notNull().default(false),
  username: text("username").notNull(),
  passwordEncrypted: text("password_encrypted").notNull(),
  fromName: text("from_name"),
  fromEmail: text("from_email").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

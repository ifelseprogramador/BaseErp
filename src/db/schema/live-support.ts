import { pgTable, pgEnum, uuid, text, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./tenancy";

/**
 * Trilha de auditoria: toda ação relevante feita pelo dono da plataforma
 * (bloquear/desbloquear, cobrança, módulos, apagar organização, sessões
 * de suporte ao vivo). `actorUserId` é sempre o usuário real que fez a
 * ação — mesmo em modo suporte, nunca troca de identidade. Só escrita/
 * lida pelo backend de admin (`core/admin/audit.ts`); nunca por
 * `withOrg()`.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").notNull(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_log_organization_id_idx").on(table.organizationId),
    index("audit_log_created_at_idx").on(table.createdAt),
  ],
);

/**
 * Sessão de suporte ao vivo (co-browsing): o admin vê a tela do app do
 * usuário em tempo real (espelhamento via rrweb, transporte por Supabase
 * Realtime Broadcast) e, se a pessoa autorizar, pode também controlar o
 * mouse/teclado remotamente. Nunca dispara sozinha — sempre nasce
 * `pending` e só começa a gravar quando vira `active`. Ver
 * `core/live-support/`.
 */
export const liveSessionStatusEnum = pgEnum("live_session_status", [
  "pending",
  "active",
  "ended",
  "declined",
]);
export const liveSessionInitiatorEnum = pgEnum("live_session_initiator", ["admin", "user"]);

export const liveSessions = pgTable(
  "live_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    initiatedBy: liveSessionInitiatorEnum("initiated_by").notNull(),
    adminUserId: uuid("admin_user_id"),
    requestedByUserId: uuid("requested_by_user_id"),
    status: liveSessionStatusEnum("status").notNull().default("pending"),
    // Começa SEM controle, mesmo depois de active — o usuário concede
    // controle do mouse/teclado numa etapa à parte (grantControl).
    controlGranted: boolean("control_granted").notNull().default(false),
    // O instantâneo completo (rrweb FullSnapshot, o DOM inteiro da tela
    // gravada) passa fácil de 200KB — grande demais para uma mensagem de
    // Realtime Broadcast, que aceita o envio mas descarta silenciosamente
    // rio abaixo quando o payload é grande demais. Por isso fica
    // persistido aqui; o admin busca sob demanda (polling curto). Só os
    // eventos incrementais (pequenos) seguem indo por Broadcast. Ver
    // docs/decisoes.md para o histórico completo das armadilhas do rrweb.
    lastFullSnapshot: jsonb("last_full_snapshot"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => [
    index("live_sessions_organization_id_idx").on(table.organizationId),
    index("live_sessions_status_idx").on(table.status),
  ],
);

export const liveSessionsRelations = relations(liveSessions, ({ one }) => ({
  organization: one(organizations, {
    fields: [liveSessions.organizationId],
    references: [organizations.id],
  }),
}));

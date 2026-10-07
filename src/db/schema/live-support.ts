import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  bigint,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
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
  // Pedido que o USUÁRIO abriu e ninguém da plataforma atendeu dentro do
  // tempo de espera (ou não havia ninguém online). O dono da plataforma
  // vê no painel e pode pedir acesso à tela depois
  // (`actions.ts#requestAccessToSession`).
  "missed",
  // Conversa só por TEXTO, sem compartilhar a tela: nasce quando o dono responde
  // pelo Telegram a um pedido sem atendimento (`telegram-bridge.ts`) e segue
  // no MESMO chat quando a tela passa a ser compartilhada (`active`).
  "chat",
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
    // QUEM é o assunto da sessão: a pessoa cuja tela é espelhada. A sessão é
    // de UMA pessoa, não da organização — antes era da organização inteira e,
    // numa empresa com vários usuários, o widget de TODOS entrava na sessão
    // (e o controle remoto do suporte valia na tela de todos). Nulo só em
    // sessões antigas, anteriores ao multiusuário.
    subjectUserId: uuid("subject_user_id"),
    // Fim da espera por atendimento (só em pedido aberto pelo usuário):
    // `now + platform_settings.support_wait_seconds`. Depois disso o pedido
    // vira `missed` (`actions.ts#expireSupportRequest`).
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    // Em conversa por texto (`chat`), o suporte pediu para ver a tela e a pessoa
    // ainda não respondeu: o widget mostra o aviso de consentimento sem fechar
    // a conversa. Volta a `false` ao aprovar (a sessão vira `active`) ou recusar.
    screenRequested: boolean("screen_requested").notNull().default(false),
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

/**
 * Conversa de texto da sessão (tipo o chat do TeamViewer): usuário e
 * suporte trocam mensagens enquanto a sessão está ativa. Persistida para
 * sobreviver a recarregar a página; o Broadcast só avisa o outro lado em
 * tempo real. Só quem participa da sessão lê/escreve (ver RLS em
 * migrations-custom).
 */
export const liveSessionMessages = pgTable(
  "live_session_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => liveSessions.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    senderUserId: uuid("sender_user_id").notNull(),
    senderRole: liveSessionInitiatorEnum("sender_role").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("live_session_messages_session_idx").on(table.sessionId, table.createdAt)],
);

/**
 * Mensagens que o servidor mandou ao Telegram do dono sobre uma sessão (o
 * alerta de pedido sem atendimento e cada mensagem do usuário encaminhada).
 * Serve para ligar uma RESPOSTA do dono ("Responder" numa dessas mensagens) de
 * volta à sessão certa. Só o servidor lê/escreve (RLS: admin/sistema).
 */
export const supportTelegramMessages = pgTable(
  "support_telegram_messages",
  {
    telegramMessageId: bigint("telegram_message_id", { mode: "number" }).primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => liveSessions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("support_telegram_messages_session_idx").on(table.sessionId)],
);

export const liveSessionsRelations = relations(liveSessions, ({ one }) => ({
  organization: one(organizations, {
    fields: [liveSessions.organizationId],
    references: [organizations.id],
  }),
}));

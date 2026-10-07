import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  date,
  boolean,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Tabelas de tenancy — fundação, não um módulo plugável. Toda tabela de
 * negócio de um vertical nascido deste template referencia
 * `organizations.id` e tem RLS habilitada via `select public.apply_org_rls(...)`
 * (ver src/db/migrations-custom/0001_rls_policies.sql).
 *
 * DIVERGÊNCIA DO mecano-erp (documentada em docs/decisoes.md): aqui a RLS
 * é a proteção ATIVA, não só defesa em profundidade — a conexão do app
 * (`DATABASE_URL`) NÃO tem `bypassrls`. Toda leitura/escrita de dado de
 * organização precisa passar por `withOrg()` (`core/auth.ts`), que abre
 * uma transação e define `app.current_user_id` via `set_config(...)`
 * antes de qualquer query — sem isso, `current_org_ids()` volta vazio e
 * as policies bloqueiam tudo.
 */

export const organizationStatusEnum = pgEnum("organization_status", ["active", "blocked"]);
export const billingStatusEnum = pgEnum("billing_status", ["em_dia", "atrasado", "cancelado"]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Nome que aparece nos documentos enviados ao cliente (PDF, link, mensagem).
  // Editável pelo dono da conta; vazio = usa `name` (nome da conta, controlado
  // pelo dono da plataforma).
  displayName: text("display_name"),
  document: text("document"), // CNPJ ou CPF da organização
  phone: text("phone"),
  address: text("address"),

  /**
   * Preset informativo de ramo de negócio (ex.: "bordados", "oficina"),
   * usado SÓ como sugestão de quais módulos habilitar por padrão ao criar
   * uma organização nova (tela em `/admin`). NÃO é lido por nenhum módulo
   * de negócio — este projeto (BaseERP) propositalmente não tem nenhum
   * módulo ainda, e a regra vale também para os verticais que nascerem
   * daqui: `businessType` nunca deve virar uma condicional dentro de
   * `modules/*` (ex. `if (org.businessType === "bordados")`). Se um
   * módulo precisar de comportamento condicional por ramo, isso deve ser
   * modelado como configuração própria do módulo (uma tabela ou um campo
   * dele), não lendo este campo. Texto livre (não enum) de propósito: um
   * vertical não deve precisar de uma migration no BaseERP só para
   * cadastrar um novo preset.
   */
  businessType: text("business_type"),

  // Branding da organização (não do dono da plataforma) — aplicado no
  // shell do app para toda a equipe daquela organização. Só quem tem
  // `role === "owner"` edita (checado em `core/profile/actions.ts`, não
  // em RLS separada). `primaryColor` é hex (ex.: "#2563eb"), sobrescreve
  // `--primary` em `globals.css`; `logoUrl` aponta para um objeto no
  // bucket público `branding` do Supabase Storage.
  primaryColor: text("primary_color"),
  sidebarColor: text("sidebar_color"),
  logoUrl: text("logo_url"),

  // Controle de acesso pelo dono da plataforma (área /admin). `status`
  // é o portão de acesso de verdade (checado em core/auth.ts#getActiveOrg);
  // `billingStatus`/`nextDueDate`/`billingNotes` são só informativos — o
  // bloqueio é sempre uma decisão manual do admin, nunca automático.
  status: organizationStatusEnum("status").notNull().default("active"),
  billingStatus: billingStatusEnum("billing_status").notNull().default("em_dia"),
  nextDueDate: date("next_due_date"),
  billingNotes: text("billing_notes"),

  // Multiusuário — liberado SÓ pelo dono da plataforma (área /admin; o
  // trigger `restrict_organization_branding_update` impede o dono da
  // conta de alterar). `multiUser = false` (padrão) = empresa de uma
  // pessoa só: sem tela de equipe, sem convite. `true` = o dono da conta
  // pode convidar até `seatLimit` pessoas ATIVAS (contando ele mesmo).
  // `extraSeatPriceCents` é só informativo (valor do usuário extra, para
  // o dono da plataforma lembrar o que combinou) — nenhuma cobrança
  // automática lê isso.
  multiUser: boolean("multi_user").notNull().default(false),
  seatLimit: integer("seat_limit").notNull().default(1),
  extraSeatPriceCents: integer("extra_seat_price_cents"),
  // Quanto um usuário DESTA organização espera por atendimento ao "Chamar
  // suporte" (com o dono da plataforma online) antes de o pedido virar "sem
  // atendimento" e o Telegram avisar. Por organização, não global: o dono da
  // plataforma combina um prazo diferente com cada cliente. 5–300 s (check no
  // banco); só o dono da plataforma altera (gatilho de organizations).
  supportWaitSeconds: integer("support_wait_seconds").notNull().default(30),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const membershipRoleEnum = pgEnum("membership_role", ["owner", "staff"]);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // FK lógica para auth.users (gerenciado pelo Supabase Auth, fora do
    // schema do Drizzle) — validada por constraint em SQL puro, ver
    // migrations-custom/0001_rls_policies.sql.
    userId: uuid("user_id").notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").notNull().default("staff"),
    // Permite bloquear uma pessoa específica dentro de uma organização,
    // sem bloquear a organização inteira — diferente de
    // organizations.status, que bloqueia todo mundo daquela organização.
    active: boolean("active").notNull().default(true),
    // Quem convidou (dono da conta) e quando — null para o dono criado
    // pelo admin da plataforma.
    invitedBy: uuid("invited_by"),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    // Setor da pessoa (texto livre, ex.: "Oficina", "Financeiro") — só
    // organização visual na tela de equipe, não controla acesso (quem
    // controla é `membership_modules`).
    department: text("department"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("memberships_user_org_unique").on(table.userId, table.organizationId)],
);

/**
 * Quais módulos cada pessoa (`staff`) pode acessar — escolhido pelo dono
 * da conta em `/equipe`, sempre dentro dos módulos que a organização tem
 * habilitados (`organization_module_settings`). O `owner` não precisa de
 * linhas aqui: acessa tudo. Sem linha = sem acesso àquele módulo.
 * `organizationId` fica redundante de propósito (RLS por organização sem
 * join) — ver migrations-custom/0009_multiuser_team.sql.
 */
export const membershipModules = pgTable(
  "membership_modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    moduleSlug: text("module_slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("membership_modules_unique").on(table.membershipId, table.moduleSlug)],
);

/**
 * Quem é dono da plataforma (você). Nunca lido via `withOrg()` — só pelo
 * backend de admin (`core/admin/`), via `requireAdmin()`. Com RLS ativa
 * (divergência do mecano-erp), esta tabela também tem policies próprias
 * (bootstrap do primeiro admin + leitura/escrita restrita a quem já é
 * admin) — ver migrations-custom/0002_platform_admin_rls.sql.
 */
export const platformAdmins = pgTable("platform_admins", {
  userId: uuid("user_id").primaryKey(),
  // Última batida de presença do painel `/admin` aberto
  // (`core/live-support/actions.ts#adminHeartbeat`, a cada ~20 s). "Online"
  // = bateu há menos de ~45 s — é o que decide, no servidor, se um pedido de
  // suporte espera atendimento ou já vira "perdida" + aviso no Telegram.
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Personalização por organização: liga/desliga um módulo especificamente
 * para uma organização (ex.: dar acesso antecipado a um módulo novo).
 * Sem linha para um módulo = usa o padrão do próprio módulo
 * (`ModuleDefinition.enabled`). Só editado pelo admin.
 */
export const organizationModuleSettings = pgTable(
  "organization_module_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    moduleSlug: text("module_slug").notNull(),
    enabled: boolean("enabled").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("org_module_settings_unique").on(table.organizationId, table.moduleSlug)],
);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  moduleSettings: many(organizationModuleSettings),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  organization: one(organizations, {
    fields: [memberships.organizationId],
    references: [organizations.id],
  }),
}));

export const organizationModuleSettingsRelations = relations(
  organizationModuleSettings,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationModuleSettings.organizationId],
      references: [organizations.id],
    }),
  }),
);

import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Histórico de acessos: uma linha por login bem-sucedido, para o dono da
 * plataforma ver quem entrou, quando e de onde (IP + localização aproximada).
 * Gravada por `core/login-history.ts#recordLogin` logo depois do login; só o
 * dono da plataforma lê e apaga (RLS em migrations-custom/0013_login_history.sql).
 * `email` e `organizationName` são cópias do momento do login (sem FK): apagar
 * a conta ou a organização não pode apagar nem alterar o histórico. A
 * localização vem dos cabeçalhos da hospedagem (Vercel/Cloudflare) — sem eles
 * (rodando local) fica vazia.
 */
export const loginEvents = pgTable(
  "login_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    email: text("email"),
    organizationName: text("organization_name"),
    ip: text("ip"),
    city: text("city"),
    region: text("region"),
    country: text("country"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("login_events_created_at_idx").on(table.createdAt)],
);

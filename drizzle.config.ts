import "./src/db/load-env";
import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` só lê o schema local (não precisa de conexão).
// `drizzle-kit studio`/`push` usam DATABASE_MIGRATION_URL quando definida
// (papel privilegiado — precisa enxergar/criar tudo), com fallback para
// DATABASE_URL (ver src/db/migrate.ts e docs/decisoes.md).
const connectionString = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL (ou DATABASE_MIGRATION_URL) não configurada. Veja .env.example.");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
  strict: true,
  verbose: true,
});

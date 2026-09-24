/**
 * Aplica as migrations do Drizzle (src/db/migrations/) e, em seguida, as
 * migrations SQL custom (src/db/migrations-custom/ — papel de app, RLS,
 * funções). Roda com `npm run db:migrate`.
 *
 * Usa `DATABASE_MIGRATION_URL` quando definida (papel privilegiado, dono
 * das tabelas — necessário para criar o papel `base_erp_app` e as
 * funções SECURITY DEFINER, ver migrations-custom/0000_app_role.sql), e
 * cai para `DATABASE_URL` quando não (conveniente em ambiente local de
 * teste onde você é o único papel disponível — nesse caso a RLS não fica
 * de fato isolada do dono, ver docs/decisoes.md).
 *
 * As migrations custom são registradas numa tabela própria
 * (`custom_migrations`) para o script ser idempotente: rodar de novo não
 * tenta recriar policy/constraint já existente.
 */
import "./load-env";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { requireEnv } from "@/core/env";

const MIGRATIONS_FOLDER = path.join(__dirname, "migrations");
const CUSTOM_MIGRATIONS_FOLDER = path.join(__dirname, "migrations-custom");

async function applyCustomMigrations(sql: postgres.Sql) {
  await sql`
    create table if not exists custom_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `;

  const files = readdirSync(CUSTOM_MIGRATIONS_FOLDER)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const [{ count }] = await sql<{ count: number }[]>`
      select count(*)::int as count from custom_migrations where name = ${file}
    `;
    if (count > 0) {
      console.log(`[migrate] custom: ${file} já aplicada, pulando`);
      continue;
    }

    console.log(`[migrate] custom: aplicando ${file}`);
    const content = readFileSync(path.join(CUSTOM_MIGRATIONS_FOLDER, file), "utf-8");
    await sql.unsafe(content);
    await sql`insert into custom_migrations (name) values (${file})`;
  }
}

async function main() {
  const connectionString = process.env.DATABASE_MIGRATION_URL ?? requireEnv("DATABASE_URL");
  const sql = postgres(connectionString, { max: 1, prepare: false });
  const db = drizzle(sql);

  console.log("[migrate] aplicando migrations do drizzle-kit...");
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  console.log("[migrate] aplicando migrations custom (papel de app, RLS, funções)...");
  await applyCustomMigrations(sql);

  console.log("[migrate] concluído.");
  await sql.end();
}

main().catch((err) => {
  console.error("[migrate] falhou:", err);
  process.exit(1);
});

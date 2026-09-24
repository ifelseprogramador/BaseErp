/**
 * Cria a primeira organização, o primeiro usuário (owner) e registra o
 * dono da plataforma (`platform_admins`, ver área /admin). Roda com
 * `npm run db:seed`, depois de `npm run db:migrate`. Idempotente: rodar
 * de novo não duplica nada.
 *
 * Usa `DATABASE_MIGRATION_URL` (papel privilegiado/dono das tabelas —
 * ver migrations-custom/0000_app_role.sql e docs/decisoes.md), com
 * fallback para `DATABASE_URL`. Como esse papel é o DONO das tabelas,
 * ele ignora a RLS por padrão (comportamento normal do Postgres para o
 * dono, sem `FORCE ROW LEVEL SECURITY`) — por isso este script pode
 * fazer `db.select()/insert()` direto, sem `runWithUserContext`. Nunca
 * rode este script fora de um ambiente que você controla, e nunca
 * aponte `DATABASE_MIGRATION_URL` para produção sem necessidade.
 */
import "./load-env";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { requireEnv } from "@/core/env";
import * as schema from "@/db/schema";
import { memberships, organizations, platformAdmins } from "@/db/schema";

async function main() {
  const orgName = process.env.SEED_ORG_NAME || "Organização Exemplo";
  const ownerEmail = requireEnv("SEED_OWNER_EMAIL");
  const ownerPassword = requireEnv("SEED_OWNER_PASSWORD");
  // Por padrão, o dono/owner da organização de exemplo também vira dono
  // da plataforma (mais simples pra testar). Em produção, defina
  // SEED_ADMIN_EMAIL com o SEU e-mail de verdade, separado de qualquer
  // organização de teste.
  const adminEmail = process.env.SEED_ADMIN_EMAIL || ownerEmail;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || ownerPassword;

  const connectionString = process.env.DATABASE_MIGRATION_URL ?? requireEnv("DATABASE_URL");
  const sql = postgres(connectionString, { max: 1, prepare: false });
  const db = drizzle(sql, { schema });

  const supabaseAdmin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

  async function findOrCreateUser(email: string, password: string) {
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const existing = existingUsers.users.find((u) => u.email === email);
    if (existing) return existing;

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    return data.user;
  }

  console.log(`[seed] garantindo organização "${orgName}"...`);
  let [org] = await db.select().from(organizations).where(eq(organizations.name, orgName));
  if (!org) {
    [org] = await db.insert(organizations).values({ name: orgName }).returning();
    console.log(`[seed] organização criada: ${org.id}`);
  } else {
    console.log(`[seed] organização já existia: ${org.id}`);
  }

  console.log(`[seed] garantindo usuário dono da organização ${ownerEmail}...`);
  const owner = await findOrCreateUser(ownerEmail, ownerPassword);
  console.log(`[seed] usuário: ${owner.id}`);

  const [existingMembership] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, owner.id));

  if (!existingMembership) {
    await db
      .insert(memberships)
      .values({ userId: owner.id, organizationId: org.id, role: "owner" });
    console.log(`[seed] membership criado: ${owner.id} -> ${org.id} (owner)`);
  } else {
    console.log("[seed] membership já existia");
  }

  console.log(`[seed] garantindo dono da plataforma (${adminEmail})...`);
  const admin = await findOrCreateUser(adminEmail, adminPassword);
  const [existingAdmin] = await db
    .select()
    .from(platformAdmins)
    .where(eq(platformAdmins.userId, admin.id));

  if (!existingAdmin) {
    await db.insert(platformAdmins).values({ userId: admin.id });
    console.log(`[seed] platform_admins criado para ${admin.id}`);
  } else {
    console.log("[seed] já era dono da plataforma");
  }

  console.log("[seed] concluído.");
  console.log(`  Login da organização de teste: ${ownerEmail}`);
  console.log(`  Login do admin (/admin): ${adminEmail}`);
  await sql.end();
}

main().catch((err) => {
  console.error("[seed] falhou:", err);
  process.exit(1);
});

/**
 * Teste de integração de isolamento por RLS — a peça central da
 * divergência do mecano-erp (ver docs/decisoes.md, "RLS ativa desde o
 * início"). Cria 2 organizações + 1 membro em cada, e confirma que uma
 * sessão Postgres "autenticada" como o usuário da organização A NUNCA
 * enxerga linhas da organização B — usando um client Postgres DIRETO
 * (pacote `postgres`, sem passar por `withOrg()`/Drizzle), exatamente
 * como pedido: a prova precisa vir do banco, não da aplicação.
 *
 * Como rodar de verdade:
 *   1. Suba um Postgres (`docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:17`
 *      ou um projeto Supabase local via `supabase start`).
 *   2. Aplique as migrations: `DATABASE_URL=... DATABASE_MIGRATION_URL=...
 *      npm run db:migrate` (a migration `0000_app_role.sql` cria o papel
 *      `base_erp_app` usado aqui).
 *   3. Rode com `DATABASE_URL` apontando para uma conexão como
 *      `base_erp_app` (sem bypassrls): `DATABASE_URL=postgresql://base_erp_app:...@localhost:5432/postgres
 *      npm run test -- rls-isolation`.
 *
 * Sem `DATABASE_URL` no ambiente (ex.: rodando `npm run check` neste
 * template sem um Postgres real por perto), o teste é pulado — nunca
 * falha por falta de infraestrutura, mas também nunca finge ter passado
 * (ver `describe.skipIf` abaixo, que deixa isso visível no relatório).
 */
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("isolamento por RLS entre organizações", () => {
  let sql: postgres.Sql;
  let orgAId: string;
  let orgBId: string;
  let adminUserId: string;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    sql = postgres(DATABASE_URL!, { prepare: false });

    // Usuários fictícios em auth.users — só os campos que a FK exige.
    // `adminUserId` é um usuário à parte, só para o setup via bootstrap de
    // admin (ver abaixo) — CRÍTICO: não pode ser o mesmo usuário usado nas
    // asserções de isolamento. Um platform admin enxerga todas as
    // organizações por desenho (`is_current_user_platform_admin()` na
    // policy), então testar isolamento logado como admin não prova nada;
    // a primeira versão deste teste tinha exatamente esse bug (promovia
    // `userA` a admin para criar as orgs, e depois testava isolamento com
    // esse mesmo `userA` — sempre "passava" mesmo que a RLS estivesse
    // quebrada, porque admin vê tudo mesmo). `userAId`/`userBId` abaixo
    // nunca entram em `platform_admins`.
    adminUserId = randomUUID();
    userAId = randomUUID();
    userBId = randomUUID();
    await sql`insert into auth.users (id, email) values (${adminUserId}, ${"admin@example.com"})`;
    await sql`insert into auth.users (id, email) values (${userAId}, ${"a@example.com"})`;
    await sql`insert into auth.users (id, email) values (${userBId}, ${"b@example.com"})`;

    // organizations/memberships exigem contexto de admin para inserir
    // (ver migrations-custom/0001_rls_policies.sql) — o `adminUserId` se
    // auto-promove a admin via a policy de bootstrap (tabela vazia).
    await sql.begin(async (tx) => {
      await tx`select set_config('app.current_user_id', ${adminUserId}, true)`;
      await tx`insert into platform_admins (user_id) values (${adminUserId}) on conflict do nothing`;
    });

    await sql.begin(async (tx) => {
      await tx`select set_config('app.current_user_id', ${adminUserId}, true)`;
      const [orgA] =
        await tx`insert into organizations (name) values (${"Organização A"}) returning id`;
      const [orgB] =
        await tx`insert into organizations (name) values (${"Organização B"}) returning id`;
      orgAId = orgA.id;
      orgBId = orgB.id;
      await tx`insert into memberships (user_id, organization_id, role) values (${userAId}, ${orgAId}, 'owner')`;
      await tx`insert into memberships (user_id, organization_id, role) values (${userBId}, ${orgBId}, 'owner')`;
    });
  });

  afterAll(async () => {
    await sql`delete from organizations where id in (${orgAId}, ${orgBId})`;
    await sql`delete from platform_admins where user_id = ${adminUserId}`;
    await sql`delete from auth.users where id in (${adminUserId}, ${userAId}, ${userBId})`;
    await sql.end();
  });

  it("usuário da organização A não enxerga a organização B", async () => {
    const rows = await sql.begin(async (tx) => {
      await tx`select set_config('app.current_user_id', ${userAId}, true)`;
      return tx`select id, name from organizations order by name`;
    });

    expect(rows.map((r) => r.id)).toContain(orgAId);
    expect(rows.map((r) => r.id)).not.toContain(orgBId);
  });

  it("usuário da organização A não enxerga memberships da organização B", async () => {
    const rows = await sql.begin(async (tx) => {
      await tx`select set_config('app.current_user_id', ${userAId}, true)`;
      return tx`select organization_id from memberships`;
    });

    expect(rows.every((r) => r.organization_id === orgAId)).toBe(true);
  });

  it("sem `app.current_user_id` definido, nenhuma organização é visível", async () => {
    const rows = await sql`select id from organizations where id in (${orgAId}, ${orgBId})`;
    expect(rows).toHaveLength(0);
  });
});

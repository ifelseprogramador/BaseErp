/**
 * Teste de integração de isolamento por RLS — a peça central da
 * divergência do mecano-erp (ver docs/decisoes.md, "RLS ativa desde o
 * início"). Cria 2 organizações + 1 membro em cada, e confirma que uma
 * sessão Postgres "autenticada" como o usuário da organização A NUNCA
 * enxerga linhas da organização B — usando um client Postgres DIRETO
 * (pacote `postgres`, sem passar por `withOrg()`/Drizzle), exatamente
 * como pedido: a prova precisa vir do banco, não da aplicação.
 *
 * Usuários de teste são criados via Admin API do Supabase
 * (`supabaseAdmin.auth.admin.createUser`), NÃO por insert direto em
 * `auth.users` — um Supabase real recusa esse insert (`permission denied
 * for table users`; a tabela é gerenciada só pelo GoTrue/Auth, mesmo o
 * dono do banco não escreve nela à mão). Essa era a versão anterior deste
 * teste, validada só contra um Postgres vanilla local (sem `auth.users`
 * de verdade) — passava lá e falhava na primeira vez que rodou contra um
 * projeto Supabase real. Descoberto e corrigido em 2026-09-24, ver
 * docs/decisoes.md.
 *
 * Como rodar de verdade (contra um projeto Supabase real, local via
 * `supabase start` ou hospedado):
 *   1. Aplique as migrations: `npm run db:migrate` (usa
 *      `DATABASE_MIGRATION_URL`/`DATABASE_URL` de `.env.local`; a
 *      migration `0000_app_role.sql` cria o papel `base_erp_app`).
 *   2. Rode com as 3 env vars abaixo apontando para esse mesmo projeto:
 *      `DATABASE_URL` = conexão como `base_erp_app` (papel de app, sem
 *      bypassrls — ver README "Configurando o banco" para o formato
 *      exato da connection string via pooler), `NEXT_PUBLIC_SUPABASE_URL`
 *      e `SUPABASE_SERVICE_ROLE_KEY` = os mesmos do projeto.
 *      `DATABASE_URL=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx vitest run rls-isolation`
 *
 * Sem as 3 variáveis no ambiente (ex.: rodando `npm run check` neste
 * template sem um Supabase real por perto), o teste é pulado — nunca
 * falha por falta de infraestrutura, mas também nunca finge ter passado
 * (ver `describe.skipIf` abaixo, que deixa isso visível no relatório).
 *
 * Cria e apaga usuários reais no projeto Supabase apontado — nunca rode
 * isto contra um projeto de produção com dados de clientes de verdade.
 */
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(DATABASE_URL && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!canRun)("isolamento por RLS entre organizações", () => {
  let sql: postgres.Sql;
  let orgAId: string;
  let orgBId: string;
  let adminUserId: string;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    sql = postgres(DATABASE_URL!, { prepare: false });
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const suffix = Date.now();

    // `adminUserId` é um usuário à parte, só para o setup via bootstrap de
    // admin (ver abaixo) — CRÍTICO: não pode ser o mesmo usuário usado nas
    // asserções de isolamento. Um platform admin enxerga todas as
    // organizações por desenho (`is_current_user_platform_admin()` na
    // policy), então testar isolamento logado como admin não prova nada;
    // uma versão anterior deste teste promovia `userA` a admin para criar
    // as orgs, e depois testava isolamento com esse mesmo `userA` —
    // sempre "passava" mesmo que a RLS estivesse quebrada, porque admin
    // vê tudo mesmo (ver docs/decisoes.md). `userAId`/`userBId` abaixo
    // nunca entram em `platform_admins`.
    const createUser = async (email: string) => {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: "Teste123!Descartavel",
        email_confirm: true,
      });
      if (error) throw error;
      return data.user!.id;
    };

    adminUserId = await createUser(`rls-test-admin-${suffix}@example.com`);
    userAId = await createUser(`rls-test-a-${suffix}@example.com`);
    userBId = await createUser(`rls-test-b-${suffix}@example.com`);

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
        await tx`insert into organizations (name) values (${"RLS Test Org A " + suffix}) returning id`;
      const [orgB] =
        await tx`insert into organizations (name) values (${"RLS Test Org B " + suffix}) returning id`;
      orgAId = orgA.id;
      orgBId = orgB.id;
      await tx`insert into memberships (user_id, organization_id, role) values (${userAId}, ${orgAId}, 'owner')`;
      await tx`insert into memberships (user_id, organization_id, role) values (${userBId}, ${orgBId}, 'owner')`;
    });
  });

  afterAll(async () => {
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    await sql`delete from memberships where organization_id in (${orgAId}, ${orgBId})`;
    await sql`delete from organizations where id in (${orgAId}, ${orgBId})`;
    await sql`delete from platform_admins where user_id = ${adminUserId}`;
    await sql.end();
    await Promise.all(
      [adminUserId, userAId, userBId].map((id) => supabaseAdmin.auth.admin.deleteUser(id)),
    );
  });

  it("usuário da organização A não enxerga a organização B", async () => {
    const rows = await sql.begin(async (tx) => {
      await tx`select set_config('app.current_user_id', ${userAId}, true)`;
      return tx`select id, name from organizations where id in (${orgAId}, ${orgBId}) order by name`;
    });

    expect(rows.map((r) => r.id)).toContain(orgAId);
    expect(rows.map((r) => r.id)).not.toContain(orgBId);
  });

  it("usuário da organização A não enxerga memberships da organização B", async () => {
    const rows = await sql.begin(async (tx) => {
      await tx`select set_config('app.current_user_id', ${userAId}, true)`;
      return tx`select organization_id from memberships where organization_id in (${orgAId}, ${orgBId})`;
    });

    expect(rows.every((r) => r.organization_id === orgAId)).toBe(true);
  });

  it("sem `app.current_user_id` definido, nenhuma organização é visível", async () => {
    const rows = await sql`select id from organizations where id in (${orgAId}, ${orgBId})`;
    expect(rows).toHaveLength(0);
  });
});

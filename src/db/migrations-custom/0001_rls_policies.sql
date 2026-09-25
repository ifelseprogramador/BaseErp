-- Migration custom (fora do drizzle-kit, que não modela `auth.users` nem
-- RLS). Roda depois das migrations do drizzle-kit — ver src/db/migrate.ts.
--
-- DIVERGÊNCIA DO mecano-erp (ver docs/decisoes.md, "RLS ativa desde o
-- início"): lá a conexão do app usa o papel `postgres` com `bypassrls`, e
-- RLS é só defesa em profundidade (a proteção real é o filtro manual
-- `organizationId` em `withOrg()`). Aqui o papel de `DATABASE_URL` NÃO
-- tem `bypassrls` — RLS é a proteção ativa. Por isso as funções abaixo
-- NÃO usam `auth.uid()` (que só resolve dentro do Data API / Realtime do
-- Supabase, autenticado via JWT verificado pelo PostgREST — uma conexão
-- direta via `postgres-js`, como a nossa, nunca populariza esse
-- contexto). Em vez disso, usamos uma variável de sessão própria,
-- `app.current_user_id`, definida explicitamente por
-- `core/db.ts#runWithUserContext` no início de cada transação de
-- request — ver esse arquivo para o porquê de `set_config(..., true)`.
--
-- Padrão a seguir em TODA tabela de negócio nova (de um módulo/vertical):
-- tem `organization_id`, e uma linha `select public.apply_org_rls('nome_da_tabela');`
-- nesta migration ou numa nova, trocando o nome da tabela.

-- memberships.user_id referencia auth.users, que vive fora do schema
-- público e não é modelado pelo Drizzle.
alter table "memberships"
  add constraint "memberships_user_id_auth_users_id_fk"
  foreign key ("user_id") references auth.users(id) on delete cascade;

-- Usuário "atual" do ponto de vista da RLS: lido da variável de sessão
-- definida por `runWithUserContext`, nunca de `auth.uid()` (ver acima).
-- `true` no segundo argumento de `current_setting` faz retornar NULL em
-- vez de lançar erro quando a variável nunca foi definida (ex.: uma
-- conexão de manutenção feita à mão, fora do fluxo da aplicação) —
-- resultado é "nenhuma organização", nunca um erro que vaze detalhe.
create or replace function public.current_app_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid
$$;

-- Organizações do usuário "atual". SECURITY DEFINER é necessário para não
-- cair em recursão infinita quando a própria tabela `memberships` também
-- tem RLS habilitada (a policy de memberships chama esta função, que por
-- sua vez consulta memberships ignorando RLS).
create or replace function public.current_org_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id from memberships where user_id = public.current_app_user_id()
$$;

grant execute on function public.current_app_user_id() to authenticated;
grant execute on function public.current_org_ids() to authenticated;

-- Precisa vir ANTES de qualquer policy/helper que a chame nesta mesma
-- migration (organizations/memberships abaixo, e `apply_org_rls()`) —
-- movida para cá de 0002_platform_admin_rls.sql, que a usava antes de
-- defini-la (bug de ordenação: a tabela `platform_admins` já existe neste
-- ponto, criada pelas migrations do drizzle-kit que rodam antes de toda
-- migration custom, então não há problema em definir a função aqui).
-- SECURITY DEFINER: precisa poder ler `platform_admins` ignorando a
-- própria RLS dessa tabela (senão vira recursão/círculo — a policy de
-- toda outra tabela chama esta função, que checaria a RLS de
-- platform_admins, que checaria esta função...).
--
-- `current_setting('app.is_system', true) = 'true'` cobre o cron de
-- backup (`api/cron/backup/route.ts`, `core/db.ts#runWithSystemContext`):
-- ele roda sem sessão de usuário nenhuma (protegido por `CRON_SECRET` na
-- camada HTTP, não por login), então precisa do mesmo acesso "enxerga
-- tudo" que um admin tem — nunca definido por código que não tenha
-- primeiro validado o `CRON_SECRET`.
create or replace function public.is_current_user_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(current_setting('app.is_system', true), '') = 'true'
    or exists (
      select 1 from platform_admins where user_id = public.current_app_user_id()
    )
$$;

grant execute on function public.is_current_user_platform_admin() to authenticated;

-- Helper para não reescrever as mesmas 4 policies em toda migration de
-- módulo novo: habilita RLS numa tabela com `organization_id` e cria as
-- policies de select/insert/update/delete restritas a
-- `current_org_ids()` OU a um platform admin agindo (`is_current_user_platform_admin()`,
-- definida acima) — o admin precisa enxergar/editar qualquer organização a partir da MESMA
-- conexão RLS-ativa, não há um segundo papel de banco "sem RLS" aqui.
-- Uso (numa migration custom nova):
--   select public.apply_org_rls('nome_da_tabela');
create or replace function public.apply_org_rls(table_name text)
returns void
language plpgsql
as $$
begin
  execute format('alter table %I enable row level security', table_name);
  execute format(
    'create policy %I on %I for select to authenticated using (organization_id in (select public.current_org_ids()) or public.is_current_user_platform_admin())',
    table_name || '_select_own_org', table_name
  );
  execute format(
    'create policy %I on %I for insert to authenticated with check (organization_id in (select public.current_org_ids()) or public.is_current_user_platform_admin())',
    table_name || '_insert_own_org', table_name
  );
  execute format(
    'create policy %I on %I for update to authenticated using (organization_id in (select public.current_org_ids()) or public.is_current_user_platform_admin()) with check (organization_id in (select public.current_org_ids()) or public.is_current_user_platform_admin())',
    table_name || '_update_own_org', table_name
  );
  execute format(
    'create policy %I on %I for delete to authenticated using (organization_id in (select public.current_org_ids()) or public.is_current_user_platform_admin())',
    table_name || '_delete_own_org', table_name
  );
end;
$$;

alter table "organizations" enable row level security;
alter table "memberships" enable row level security;

create policy "organizations_select_own" on "organizations"
  for select to authenticated
  using (id in (select public.current_org_ids()) or public.is_current_user_platform_admin());

create policy "organizations_admin_write" on "organizations"
  for all to authenticated
  using (public.is_current_user_platform_admin())
  with check (public.is_current_user_platform_admin());

create policy "memberships_select_own_org" on "memberships"
  for select to authenticated
  using (organization_id in (select public.current_org_ids()) or public.is_current_user_platform_admin());

create policy "memberships_admin_write" on "memberships"
  for all to authenticated
  using (public.is_current_user_platform_admin())
  with check (public.is_current_user_platform_admin());

-- Sem policy de insert/update/delete para o dono comum: criar
-- organização/membership é sempre uma ação de admin (`core/admin/actions.ts`,
-- rodando com `is_current_user_platform_admin() = true`) ou do script de
-- seed local (ver 0002_platform_admin_rls.sql para o bootstrap do
-- primeiro admin).

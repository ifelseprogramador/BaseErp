-- RLS de `platform_admins` e `organization_module_settings` — aqui a RLS
-- é a proteção ativa (ver 0001_rls_policies.sql e docs/decisoes.md), não
-- só defesa em profundidade como no mecano-erp.

alter table "platform_admins" enable row level security;
alter table "organization_module_settings" enable row level security;

-- FK lógica para auth.users, mesmo padrão de memberships (0001).
alter table "platform_admins"
  add constraint "platform_admins_user_id_auth_users_id_fk"
  foreign key ("user_id") references auth.users(id) on delete cascade;

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

-- Só um admin já confirmado pode ler/editar a lista de admins...
create policy "platform_admins_admin_rw" on "platform_admins"
  for all to authenticated
  using (public.is_current_user_platform_admin())
  with check (public.is_current_user_platform_admin());

-- ...EXCETO o bootstrap do primeiro admin: se a tabela ainda está vazia,
-- qualquer usuário autenticado pode se auto-inserir uma única vez (quem
-- rodar `npm run db:seed` logo após migrar, com a própria conta). Depois
-- que existir ao menos um admin, esta policy nunca mais libera nada (o
-- `not exists` fica falso), e todo admin novo precisa ser adicionado por
-- um admin existente (via `core/admin/`, rodando com
-- is_current_user_platform_admin() = true, coberto pela policy acima).
create policy "platform_admins_bootstrap_insert" on "platform_admins"
  for insert to authenticated
  with check (not exists (select 1 from platform_admins));

select public.apply_org_rls('organization_module_settings');

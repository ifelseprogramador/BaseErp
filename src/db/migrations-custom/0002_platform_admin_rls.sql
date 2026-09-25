-- RLS de `platform_admins` e `organization_module_settings` — aqui a RLS
-- é a proteção ativa (ver 0001_rls_policies.sql e docs/decisoes.md), não
-- só defesa em profundidade como no mecano-erp.

alter table "platform_admins" enable row level security;
alter table "organization_module_settings" enable row level security;

-- FK lógica para auth.users, mesmo padrão de memberships (0001).
alter table "platform_admins"
  add constraint "platform_admins_user_id_auth_users_id_fk"
  foreign key ("user_id") references auth.users(id) on delete cascade;

-- `is_current_user_platform_admin()` foi movida para 0001_rls_policies.sql
-- (definida antes de ser usada pelas policies de organizations/memberships
-- daquele arquivo — ver o comentário lá para o porquê).

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

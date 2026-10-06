-- Suporte ao vivo por PESSOA (ver docs/decisoes.md, "Suporte ao vivo por
-- pessoa, espera configurável e chat"). Roda DEPOIS de
-- src/db/migrations/0007_*.sql (drizzle-kit), que cria
-- `live_sessions.subject_user_id/expires_at`, `live_session_messages`,
-- `platform_settings`, `platform_admins.last_seen_at` e o status `missed`.
--
-- 1. `live_sessions` deixa de ser "da organização" (apply_org_rls: qualquer
--    membro lia e alterava a sessão de qualquer colega) e passa a ser da
--    pessoa cuja tela é espelhada (`subject_user_id`). Colega de empresa não
--    vê nem encerra a sessão do outro.
-- 2. `live_session_messages`: só quem participa lê/escreve, e só com a
--    sessão ativa.
-- 3. `platform_settings`: leitura para qualquer autenticado (é só o tempo de
--    espera); escrita só do admin.
-- 4. `any_platform_admin_online()`: o usuário não pode ler `platform_admins`
--    (RLS), então a pergunta "tem suporte online?" passa por uma função
--    SECURITY DEFINER que só devolve sim/não.

drop policy if exists "live_sessions_select_own_org" on "live_sessions";
drop policy if exists "live_sessions_insert_own_org" on "live_sessions";
drop policy if exists "live_sessions_update_own_org" on "live_sessions";
drop policy if exists "live_sessions_delete_own_org" on "live_sessions";

create policy "live_sessions_select_subject" on "live_sessions"
  for select to authenticated
  using (
    public.is_current_user_platform_admin()
    or (
      organization_id in (select public.current_org_ids())
      and subject_user_id = public.current_app_user_id()
    )
  );

create policy "live_sessions_insert_subject" on "live_sessions"
  for insert to authenticated
  with check (
    public.is_current_user_platform_admin()
    or (
      organization_id in (select public.current_org_ids())
      and subject_user_id = public.current_app_user_id()
      and requested_by_user_id = public.current_app_user_id()
      and initiated_by = 'user'
    )
  );

create policy "live_sessions_update_subject" on "live_sessions"
  for update to authenticated
  using (
    public.is_current_user_platform_admin()
    or (
      organization_id in (select public.current_org_ids())
      and subject_user_id = public.current_app_user_id()
    )
  )
  with check (
    public.is_current_user_platform_admin()
    or (
      organization_id in (select public.current_org_ids())
      and subject_user_id = public.current_app_user_id()
    )
  );

create policy "live_sessions_delete_admin" on "live_sessions"
  for delete to authenticated
  using (public.is_current_user_platform_admin());

alter table "live_session_messages" enable row level security;

create policy "live_session_messages_select_participant" on "live_session_messages"
  for select to authenticated
  using (
    public.is_current_user_platform_admin()
    or exists (
      select 1 from live_sessions s
      where s.id = session_id and s.subject_user_id = public.current_app_user_id()
    )
  );

create policy "live_session_messages_insert_participant" on "live_session_messages"
  for insert to authenticated
  with check (
    sender_user_id = public.current_app_user_id()
    and exists (
      select 1 from live_sessions s
      where s.id = session_id
        and s.organization_id = live_session_messages.organization_id
        and s.status = 'active'
        and (
          (sender_role = 'admin' and public.is_current_user_platform_admin())
          or (sender_role = 'user' and s.subject_user_id = public.current_app_user_id())
        )
    )
  );

create policy "live_session_messages_admin_delete" on "live_session_messages"
  for delete to authenticated
  using (public.is_current_user_platform_admin());

alter table "platform_settings" enable row level security;

create policy "platform_settings_select_all" on "platform_settings"
  for select to authenticated
  using (true);

create policy "platform_settings_admin_write" on "platform_settings"
  for all to authenticated
  using (public.is_current_user_platform_admin())
  with check (public.is_current_user_platform_admin());

alter table "platform_settings"
  add constraint "platform_settings_wait_range"
  check (support_wait_seconds between 5 and 300);

insert into "platform_settings" (id) values ('singleton') on conflict do nothing;

create or replace function public.any_platform_admin_online(window_seconds integer default 45)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from platform_admins
    where last_seen_at is not null
      and last_seen_at > now() - make_interval(secs => window_seconds)
  )
$$;

grant execute on function public.any_platform_admin_online(integer) to authenticated;

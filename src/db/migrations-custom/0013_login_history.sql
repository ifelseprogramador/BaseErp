-- Histórico de acessos (ver docs/decisoes.md, "Histórico de acessos"). Roda
-- DEPOIS de src/db/migrations/0009_*.sql (drizzle-kit), que cria `login_events`.
--
-- Quem entrou grava a PRÓPRIA linha (insert só com user_id = quem está logado,
-- nunca em nome de outra pessoa); só o dono da plataforma lê e apaga — nem a
-- própria organização enxerga o histórico.

alter table "login_events" enable row level security;

create policy "login_events_insert_self" on "login_events"
  for insert to authenticated
  with check (user_id = public.current_app_user_id());

create policy "login_events_admin_select" on "login_events"
  for select to authenticated
  using (public.is_current_user_platform_admin());

create policy "login_events_admin_delete" on "login_events"
  for delete to authenticated
  using (public.is_current_user_platform_admin());

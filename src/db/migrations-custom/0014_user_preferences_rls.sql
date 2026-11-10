-- Preferências pessoais de interface (ver docs/decisoes.md, "Modo Fácil").
-- Roda DEPOIS de src/db/migrations/0011_*.sql (drizzle-kit), que cria
-- `user_preferences`.
--
-- Cada pessoa lê, cria e altera SÓ a própria linha; ninguém apaga (voltar ao
-- padrão é gravar `formal`).

alter table "user_preferences" enable row level security;

alter table "user_preferences"
  add constraint "user_preferences_ui_mode_check" check (ui_mode in ('formal', 'facil'));

create policy "user_preferences_select_self" on "user_preferences"
  for select to authenticated
  using (user_id = public.current_app_user_id());

create policy "user_preferences_insert_self" on "user_preferences"
  for insert to authenticated
  with check (user_id = public.current_app_user_id());

create policy "user_preferences_update_self" on "user_preferences"
  for update to authenticated
  using (user_id = public.current_app_user_id())
  with check (user_id = public.current_app_user_id());

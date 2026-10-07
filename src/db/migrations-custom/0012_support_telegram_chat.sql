-- Conversa por Telegram + espera por organização (ver docs/decisoes.md,
-- "Suporte: conversa pelo Telegram e espera por organização"). Roda DEPOIS de
-- src/db/migrations/0008_*.sql (drizzle-kit), que cria o status `chat`,
-- `live_sessions.screen_requested`, `support_telegram_messages` e
-- `organizations.support_wait_seconds`.
--
-- 1. O chat passa a aceitar mensagens também com a sessão em `chat` (conversa
--    só por texto, sem tela) — antes só com `active`.
-- 2. `support_telegram_messages`: só admin/sistema (o servidor grava o mapa
--    "mensagem do Telegram → sessão"; a pessoa nunca lê isso).
-- 3. `organizations.support_wait_seconds`: 5–300 s e só o dono da PLATAFORMA
--    altera (estende o gatilho de organizations).

drop policy if exists "live_session_messages_insert_participant" on "live_session_messages";

create policy "live_session_messages_insert_participant" on "live_session_messages"
  for insert to authenticated
  with check (
    sender_user_id = public.current_app_user_id()
    and exists (
      select 1 from live_sessions s
      where s.id = session_id
        and s.organization_id = live_session_messages.organization_id
        and s.status in ('active', 'chat')
        and (
          (sender_role = 'admin' and public.is_current_user_platform_admin())
          or (sender_role = 'user' and s.subject_user_id = public.current_app_user_id())
        )
    )
  );

alter table "support_telegram_messages" enable row level security;

create policy "support_telegram_messages_admin_all" on "support_telegram_messages"
  for all to authenticated
  using (public.is_current_user_platform_admin())
  with check (public.is_current_user_platform_admin());

alter table "organizations"
  add constraint "organizations_support_wait_range"
  check (support_wait_seconds between 5 and 300);

create or replace function public.restrict_organization_branding_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_current_user_platform_admin() then
    return new;
  end if;

  if new.name is distinct from old.name
    or new.business_type is distinct from old.business_type
    or new.status is distinct from old.status
    or new.billing_status is distinct from old.billing_status
    or new.next_due_date is distinct from old.next_due_date
    or new.billing_notes is distinct from old.billing_notes
    or new.multi_user is distinct from old.multi_user
    or new.seat_limit is distinct from old.seat_limit
    or new.extra_seat_price_cents is distinct from old.extra_seat_price_cents
    or new.support_wait_seconds is distinct from old.support_wait_seconds
  then
    raise exception 'Só o dono da plataforma pode alterar esses campos.';
  end if;

  return new;
end;
$$;

-- Multiusuário por organização (ver docs/decisoes.md, "Multiusuário").
-- Roda DEPOIS de src/db/migrations/0005_multiuser_team.sql (drizzle-kit),
-- que cria as colunas `organizations.multi_user/seat_limit/
-- extra_seat_price_cents`, `memberships.invited_by/invited_at/department`
-- e a tabela `membership_modules`.
--
-- Cinco peças:
-- 1. `current_org_ids()`/`current_owner_org_ids()` passam a ignorar
--    memberships DESATIVADOS (`active = false`) — antes só a camada da
--    aplicação (`core/auth.ts`) barrava, o banco continuava liberando os
--    dados pra quem foi desativado. `memberships_select_self` garante que
--    a pessoa desativada ainda enxerga a PRÓPRIA linha, pra aplicação
--    conseguir dizer "acesso bloqueado" em vez de "sem organização".
-- 2. O dono da conta (role='owner') passa a poder convidar (insert) e
--    desativar/reativar/mudar setor (update) de pessoas `staff` da própria
--    organização. Nunca cria/edita outro `owner`, nunca muda papel,
--    usuário ou organização de uma linha (trigger abaixo).
-- 3. Limite de assentos no banco (defesa em profundidade — a Server
--    Action já checa antes, com mensagem amigável): só entra mais um
--    `staff` ATIVO se a organização for `multi_user` e houver assento.
-- 4. `multi_user`/`seat_limit`/`extra_seat_price_cents` só o dono da
--    PLATAFORMA altera (mesmo trigger de branding, estendido).
-- 5. `membership_modules`: todo membro lê; só o dono da conta (ou o admin)
--    escreve.

create or replace function public.current_org_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id from memberships
  where user_id = public.current_app_user_id() and active
$$;

create or replace function public.current_owner_org_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id from memberships
  where user_id = public.current_app_user_id() and role = 'owner' and active
$$;

create policy "memberships_select_self" on "memberships"
  for select to authenticated
  using (user_id = public.current_app_user_id());

-- O dono da conta enxerga nome/e-mail só de quem é membro de uma
-- organização dele (antes: só platform admin). Continua não listando
-- ninguém de fora.
create or replace function public.get_user_display_info(user_ids uuid[])
returns table (id uuid, email text, display_name text)
language sql
security definer
set search_path = public
stable
as $$
  select u.id, u.email, u.raw_user_meta_data->>'display_name' as display_name
  from auth.users u
  where u.id = any(user_ids)
    and (
      public.is_current_user_platform_admin()
      or exists (
        select 1 from memberships m
        where m.user_id = u.id
          and m.organization_id in (select public.current_owner_org_ids())
      )
    )
$$;

create policy "memberships_owner_insert_staff" on "memberships"
  for insert to authenticated
  with check (
    organization_id in (select public.current_owner_org_ids())
    and role = 'staff'
  );

create policy "memberships_owner_update_staff" on "memberships"
  for update to authenticated
  using (
    organization_id in (select public.current_owner_org_ids())
    and role = 'staff'
  )
  with check (
    organization_id in (select public.current_owner_org_ids())
    and role = 'staff'
  );

create or replace function public.restrict_membership_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_current_user_platform_admin() then
    return new;
  end if;

  if new.user_id is distinct from old.user_id
    or new.organization_id is distinct from old.organization_id
    or new.role is distinct from old.role
    or new.invited_by is distinct from old.invited_by
    or new.invited_at is distinct from old.invited_at
  then
    raise exception 'Só é possível alterar o setor e o status de acesso da pessoa.';
  end if;

  return new;
end;
$$;

create trigger memberships_restrict_update
  before update on "memberships"
  for each row
  execute function public.restrict_membership_update();

create or replace function public.enforce_membership_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_row organizations%rowtype;
  active_count integer;
begin
  if public.is_current_user_platform_admin() then
    return new;
  end if;

  -- Só limita `staff`: o primeiro dono entra por caminho próprio (admin
  -- da plataforma ou seed), nunca por convite.
  if new.role <> 'staff' or not new.active then
    return new;
  end if;

  -- Só conta quando a linha está ENTRANDO no grupo de ativos (insert, ou
  -- update de inativo para ativo) — editar o setor de quem já é ativo não
  -- reconfere.
  if tg_op = 'UPDATE' and old.active then
    return new;
  end if;

  -- Trava a linha da organização: dois convites simultâneos não passam
  -- juntos pelo mesmo último assento.
  select * into org_row from organizations where id = new.organization_id for update;

  if not org_row.multi_user then
    raise exception 'Esta empresa não tem o modo multiusuário liberado.';
  end if;

  select count(*) into active_count
  from memberships
  where organization_id = new.organization_id and active and id <> new.id;

  if active_count >= org_row.seat_limit then
    raise exception 'Limite de usuários da empresa atingido (%).', org_row.seat_limit;
  end if;

  return new;
end;
$$;

create trigger memberships_enforce_seat_limit
  before insert or update of active on "memberships"
  for each row
  execute function public.enforce_membership_seat_limit();

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
  then
    raise exception 'Só o dono da plataforma pode alterar esses campos.';
  end if;

  return new;
end;
$$;

alter table "membership_modules" enable row level security;

create policy "membership_modules_select_own_org" on "membership_modules"
  for select to authenticated
  using (organization_id in (select public.current_org_ids()) or public.is_current_user_platform_admin());

create policy "membership_modules_owner_write" on "membership_modules"
  for all to authenticated
  using (organization_id in (select public.current_owner_org_ids()) or public.is_current_user_platform_admin())
  with check (
    (organization_id in (select public.current_owner_org_ids()) or public.is_current_user_platform_admin())
    and exists (
      select 1 from memberships m
      where m.id = membership_id and m.organization_id = membership_modules.organization_id
    )
  );

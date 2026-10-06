-- Auditoria de negócio (ver docs/decisoes.md, "Auditoria de negócio e
-- histórico de status"). Roda DEPOIS de src/db/migrations/0006_*.sql
-- (drizzle-kit), que cria `status_history`.
--
-- 1. `set_audit_columns()` + `apply_audit_columns(tabela)`: gatilho que
--    preenche `created_by`/`updated_by` a partir de `app.current_user_id`.
--    A coluna é criada pelo drizzle (`auditColumns` em db/schema/audit.ts);
--    cada módulo liga o gatilho na própria migration custom.
-- 2. `get_user_display_info` passa a servir qualquer MEMBRO da organização
--    (não só o dono da conta e o admin), para mostrar "criado por Fulano"
--    a quem trabalha junto. Só devolve gente de organizações do próprio
--    chamador (`current_org_ids()`), nome de exibição e e-mail.
-- 3. `status_history`: RLS — membros leem e inserem (só em nome próprio);
--    ninguém edita nem apaga (só o admin/sistema).

create or replace function public.set_audit_columns()
returns trigger
language plpgsql
as $$
declare
  actor uuid := public.current_app_user_id();
begin
  if tg_op = 'INSERT' then
    -- A sessão manda: um cliente nunca escolhe a própria autoria.
    new.created_by := coalesce(actor, new.created_by);
    new.updated_by := coalesce(actor, new.updated_by);
  else
    new.created_by := old.created_by;
    new.updated_by := coalesce(actor, old.updated_by);
  end if;
  return new;
end;
$$;

create or replace function public.apply_audit_columns(table_name text)
returns void
language plpgsql
as $$
begin
  execute format('drop trigger if exists %I on %I', table_name || '_audit_columns', table_name);
  execute format(
    'create trigger %I before insert or update on %I for each row execute function public.set_audit_columns()',
    table_name || '_audit_columns', table_name
  );
end;
$$;

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
          and m.organization_id in (select public.current_org_ids())
      )
    )
$$;

alter table "status_history" enable row level security;

create policy "status_history_select_own_org" on "status_history"
  for select to authenticated
  using (organization_id in (select public.current_org_ids()) or public.is_current_user_platform_admin());

create policy "status_history_insert_own_org" on "status_history"
  for insert to authenticated
  with check (
    (organization_id in (select public.current_org_ids()) and changed_by = public.current_app_user_id())
    or public.is_current_user_platform_admin()
  );

create policy "status_history_admin_delete" on "status_history"
  for delete to authenticated
  using (public.is_current_user_platform_admin());

-- Dono (role='owner') da organização passou a poder editar o branding
-- (cor/logo) da própria organização, via /perfil
-- (core/profile/actions.ts#updateOrganizationBranding) — primeira vez
-- que alguém que NÃO é platform admin escreve na tabela `organizations`.
-- Até aqui só existia "organizations_admin_write" (admin-only, ver
-- 0001_rls_policies.sql), então esse UPDATE sempre batia em 0 linhas —
-- RLS bloqueia silenciosamente, sem erro nenhum — e a Server Action não
-- checava quantas linhas foram afetadas. Bug em produção: a tela dizia
-- "Aparência atualizada" mas cor/logo nunca persistiam.
--
-- Não dá pra restringir por COLUNA só com GRANT: é o mesmo papel de
-- banco (`base_erp_app`) que atende tanto o admin quanto um owner comum
-- — não há dois papéis Postgres diferentes pra isso (ver
-- docs/decisoes.md). Por isso, duas peças:
-- 1. Uma policy de UPDATE nova, restrita a quem é role='owner' na
--    organização (current_owner_org_ids(), abaixo — current_org_ids()
--    já existente não filtra por role, um staff também apareceria).
-- 2. Um trigger que rejeita qualquer mudança fora de
--    primary_color/logo_url/updated_at quando quem está editando NÃO é
--    platform admin — sem isso, um owner poderia chamar a API do
--    Supabase direto (fora do Next.js, passando por cima da checagem
--    `role !== "owner"` da Server Action) e tentar mudar status/cobrança
--    da própria organização.

create or replace function public.current_owner_org_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id from memberships
  where user_id = public.current_app_user_id() and role = 'owner'
$$;

grant execute on function public.current_owner_org_ids() to authenticated;

create policy "organizations_owner_update_branding" on "organizations"
  for update to authenticated
  using (id in (select public.current_owner_org_ids()))
  with check (id in (select public.current_owner_org_ids()));

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
    or new.document is distinct from old.document
    or new.phone is distinct from old.phone
    or new.address is distinct from old.address
    or new.business_type is distinct from old.business_type
    or new.status is distinct from old.status
    or new.billing_status is distinct from old.billing_status
    or new.next_due_date is distinct from old.next_due_date
    or new.billing_notes is distinct from old.billing_notes
  then
    raise exception 'Só o dono da plataforma pode alterar esses campos.';
  end if;

  return new;
end;
$$;

create trigger organizations_restrict_branding_update
  before update on "organizations"
  for each row
  execute function public.restrict_organization_branding_update();

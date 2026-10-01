-- O dono da CONTA passa a poder editar os dados que saem nos documentos
-- (nome de exibição, CNPJ/CPF, telefone, endereço). Continuam restritos ao
-- dono da PLATAFORMA: nome da conta, ramo, status e cobrança.
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
  then
    raise exception 'Só o dono da plataforma pode alterar esses campos.';
  end if;

  return new;
end;
$$;

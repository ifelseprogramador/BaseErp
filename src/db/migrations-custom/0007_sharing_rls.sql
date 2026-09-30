-- RLS de compartilhamento de documentos + leitura pública por token.
alter table "shared_documents" enable row level security;
select public.apply_org_rls('shared_documents');

alter table "organization_email_settings" enable row level security;
select public.apply_org_rls('organization_email_settings');

-- Leitura PÚBLICA de um documento compartilhado (página /d/<token>): o
-- visitante não tem sessão, então a RLS não se aplica. A função roda como
-- dono (SECURITY DEFINER), só devolve documento não expirado e não
-- revogado, e devolve apenas o necessário para renderizar. Registra a
-- visualização (primeira vez + contador).
create or replace function public.get_shared_document(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  update shared_documents
     set view_count = view_count + 1,
         first_viewed_at = coalesce(first_viewed_at, now())
   where token_hash = p_token_hash
     and revoked_at is null
     and expires_at > now()
  returning jsonb_build_object(
    'kind', kind,
    'title', title,
    'payload', payload,
    'expiresAt', expires_at
  ) into result;
  return result;
end;
$$;

-- EXECUTE fica no padrão (PUBLIC): o papel de app varia por vertical
-- (base_erp_app, mecano_erp_app…) e a função é segura por desenho.

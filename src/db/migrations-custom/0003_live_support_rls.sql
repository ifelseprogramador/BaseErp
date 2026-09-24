-- RLS de audit_log e live_sessions. `live_sessions` segue o padrão comum
-- de organização; `audit_log` é só do admin (nem membro de organização
-- deveria ler, mesmo com RLS ativa) — ver docs/decisoes.md.

alter table "audit_log" enable row level security;
alter table "live_sessions" enable row level security;

select public.apply_org_rls('live_sessions');

-- audit_log: só o admin, nunca a organização (mesmo sendo a "dona" da
-- linha via organization_id) — quem fez a ação foi o admin agindo sobre
-- ela, não a própria organização.
create policy "audit_log_admin_only" on "audit_log"
  for all to authenticated
  using (public.is_current_user_platform_admin())
  with check (public.is_current_user_platform_admin());

-- RLS de backup e notificações.

alter table "organization_backup_settings" enable row level security;
select public.apply_org_rls('organization_backup_settings');

alter table "organization_backups" enable row level security;
select public.apply_org_rls('organization_backups');

-- notifications: organization_id NULO significa "para todo mundo" — a
-- policy padrão de apply_org_rls só libera quando bate organization_id,
-- então uma notificação global (organization_id is null) precisa de uma
-- cláusula própria além da de apply_org_rls.
alter table "notifications" enable row level security;

create policy "notifications_select" on "notifications"
  for select to authenticated
  using (
    organization_id is null
    or organization_id in (select public.current_org_ids())
    or public.is_current_user_platform_admin()
  );

create policy "notifications_admin_write" on "notifications"
  for all to authenticated
  using (public.is_current_user_platform_admin())
  with check (public.is_current_user_platform_admin());

alter table "notification_reads" enable row level security;
select public.apply_org_rls('notification_reads');

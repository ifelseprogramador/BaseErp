-- Papel de conexão da APLICAÇÃO em runtime, separado do papel usado para
-- rodar migrations (o que está em `DATABASE_URL` ao rodar `db:migrate`/
-- `db:generate`, tipicamente `postgres`/o dono do projeto Supabase, que
-- tem `bypassrls` por padrão). Isso é necessário para a RLS ser a
-- proteção ATIVA (ver docs/decisoes.md, "RLS ativa desde o início"):
-- dono de tabela e superusuário sempre ignoram RLS, com ou sem
-- `bypassrls`, a não ser que a tabela use `FORCE ROW LEVEL SECURITY` — e
-- forçar RLS no dono quebraria as funções SECURITY DEFINER abaixo
-- (`current_org_ids()`, `is_current_user_platform_admin()`), que
-- PRECISAM rodar como o dono/privilegiado para evitar recursão infinita
-- ao consultar `memberships`/`platform_admins` por dentro.
--
-- Por isso: as migrations (esta incluída) rodam com o papel privilegiado,
-- mas a APLICAÇÃO EM PRODUÇÃO deve trocar `DATABASE_URL` para conectar
-- como `base_erp_app` (sem bypassrls, sem ser dono de nada) — ver
-- docs/decisoes.md e README.md, seção "Configurando o banco". Em
-- desenvolvimento local, se você não criar esse papel separado, o app
-- roda normalmente mas a RLS NÃO é de fato exercida (o papel de
-- `DATABASE_URL` continua sendo o dono) — só o teste de integração contra
-- um Postgres configurado com os dois papéis prova o isolamento de
-- verdade (ver src/core/__tests__/rls-isolation.integration.test.ts).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'base_erp_app') then
    create role base_erp_app with login nosuperuser nobypassrls nocreatedb nocreaterole noreplication;
  end if;
end
$$;

grant usage on schema public to base_erp_app;
grant select, insert, update, delete on all tables in schema public to base_erp_app;
alter default privileges in schema public
  grant select, insert, update, delete on tables to base_erp_app;
grant usage on all sequences in schema public to base_erp_app;
alter default privileges in schema public grant usage on sequences to base_erp_app;

-- Precisa poder ler `auth.users` (join feito hoje só pelo backend de
-- admin, `core/admin/queries.ts`) e ser reconhecido como o mesmo "grupo"
-- que as policies abaixo endereçam com `to authenticated` — reaproveita o
-- papel padrão do Supabase em vez de inventar outro predicado de policy.
grant authenticated to base_erp_app;
grant usage on schema auth to base_erp_app;
grant select on auth.users to base_erp_app;

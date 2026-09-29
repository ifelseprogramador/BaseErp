-- Dois bugs de permissão achados em produção (RLS ativa bloqueando
-- silenciosamente, sem erro visível pro código — mesma categoria do bug
-- de branding em 0005, mas em dois lugares novos):
--
-- 1. "Pessoas com acesso"/Histórico sempre mostravam só o UID, nunca o
--    nome nem o e-mail — mesmo depois de `core/user-lookup.ts` já saber
--    buscar `display_name`. Causa raiz nunca investigada até agora:
--    `auth.users` do Supabase tem RLS PRÓPRIA (gerenciada pelo GoTrue,
--    fora do controle deste projeto) que não conhece a variável de
--    sessão `app.current_user_id` nem a função
--    `is_current_user_platform_admin()` daqui — o `grant select on
--    auth.users` em 0000_app_role.sql dá o privilégio de tabela, mas a
--    RLS do Supabase ainda filtra TODAS as linhas pra qualquer conexão
--    que não seja o dono/superusuário. Confirmado direto no Postgres de
--    produção: `select * from auth.users` via `base_erp_app`, mesmo com
--    `app.current_user_id` setado pra um admin de verdade, sempre
--    devolve 0 linhas.
--
--    Mesma solução já usada pra `current_org_ids()`/
--    `is_current_user_platform_admin()`: uma função SECURITY DEFINER,
--    que roda com o privilégio de quem a criou (o papel de migração,
--    dono/superusuário), não do papel que chama — atravessa a RLS de
--    `auth.users` de propósito, mas só devolve linha se quem chamou for
--    platform admin (checado DENTRO da função, não do lado de fora).
--
-- 2. `live_support.chamar` (organização pedindo suporte, ação de
--    usuário comum, não admin — `core/live-support/actions.ts#callForSupport`)
--    falhava ao gravar auditoria: "audit.gravar_falhou" / erro de
--    permissão no insert. Causa: `audit_log_admin_only` (0003) só
--    libera insert/update/delete pra platform admin — mas várias ações
--    de auditoria são iniciadas pela PRÓPRIA organização (chamar
--    suporte, aprovar/recusar sessão), não só pelo admin. Nova policy
--    de INSERT liberando a própria organização, mas só pra registrar
--    A PRÓPRIA autoria (`actor_user_id = current_app_user_id()`) — nunca
--    could inserir uma entrada se passando por outra pessoa. Select/
--    update/delete continuam admin-only (ninguém de fora, nem a própria
--    organização, deveria LER o histórico de auditoria — isso não muda).

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
    and public.is_current_user_platform_admin()
$$;

grant execute on function public.get_user_display_info(uuid[]) to authenticated;

create policy "audit_log_insert_own_org" on "audit_log"
  for insert to authenticated
  with check (
    organization_id in (select public.current_org_ids())
    and actor_user_id = public.current_app_user_id()
  );

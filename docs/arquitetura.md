# Arquitetura (como)

Ver docs/decisoes.md para o "por quê" de cada escolha abaixo.

## Visão geral

BaseERP é um projeto-TEMPLATE: a fundação multi-tenant de um ERP modular,
sem nenhum módulo de negócio. Um vertical (ex.: um ERP para uma empresa de
bordados) nasce clonando este projeto e adicionando seus próprios módulos
em `src/modules/`.

```
src/
├── app/
│   ├── (auth)/login/       # login (Supabase Auth)
│   ├── (app)/              # área autenticada da organização
│   │   ├── layout.tsx      # shell: sidebar, header, live-support, notificações
│   │   ├── page.tsx        # dashboard-shell (placeholders — sem módulo ainda)
│   │   └── backup/         # backup/restore por organização
│   ├── (admin)/admin/      # painel do dono da plataforma
│   └── api/                # health check, cron de backup
├── core/                   # fundação — nunca conhece um módulo específico
│   ├── auth.ts             # getSession, getActiveOrg, withOrg
│   ├── admin-auth.ts       # requireAdmin
│   ├── db.ts               # conexão + runWithUserContext/runWithSystemContext
│   ├── registry.ts         # ModuleDefinition, registerModule, getEnabledModules
│   ├── module-settings.ts  # override de módulo por organização
│   ├── load-modules.ts     # único arquivo que importa modules/*/module.ts
│   ├── logger.ts           # logger estruturado (nunca console.* direto)
│   ├── money.ts            # Cents — dinheiro sempre em centavos
│   ├── action-result.ts    # ActionResult — retorno padrão de Server Action
│   ├── document.ts         # validação CPF/CNPJ
│   ├── csv.ts / csv-import.ts
│   ├── backup.ts           # backup/restore por organização (registerBackupTable)
│   ├── admin/              # queries/actions/components da área /admin
│   ├── live-support/       # co-browsing (rrweb + Realtime Broadcast)
│   └── notifications/      # avisos da plataforma para as organizações
├── db/
│   ├── schema.ts           # ponto único lido pelo drizzle-kit
│   ├── schema/              # tenancy, backup, notifications, live-support
│   ├── migrations/          # geradas por drizzle-kit (não editar à mão)
│   ├── migrations-custom/   # SQL puro: papel de app, RLS, funções (ver abaixo)
│   ├── migrate.ts / seed.ts
├── modules/                 # vazio neste template — ver README.md (contrato)
└── components/
    ├── ui/                  # shadcn/ui sobre Base UI (gerado, não editar à mão)
    └── layout/              # shell de navegação (sidebar/mobile nav)
```

## Tenancy

`organizations` / `memberships` / `platformAdmins` /
`organizationModuleSettings` (`src/db/schema/tenancy.ts`) são a fundação:
toda tabela de negócio de um módulo referencia `organizations.id` e usa
RLS (ver seção RLS abaixo). Uma pessoa pertence a uma organização por vez
(MVP) — `getActiveOrg()` resolve isso a partir do primeiro `membership`,
ou da organização "impersonada" quando um platform admin está em modo
suporte.

## RLS (Row-Level Security)

**Migrations custom em SQL puro**, em `src/db/migrations-custom/`,
**nunca** `pgPolicy` no schema Drizzle. Motivo: as policies dependem de
funções (`current_org_ids()`, `is_current_user_platform_admin()`) e de um
papel de banco (`base_erp_app`) que só existem depois que as migrations
do drizzle-kit já rodaram — `src/db/migrate.ts` aplica as migrations do
drizzle-kit primeiro, as custom depois, numa tabela de controle própria
(`custom_migrations`) que torna o processo idempotente.

Toda tabela de negócio nova chama, numa migration custom:

```sql
select public.apply_org_rls('nome_da_tabela');
```

Isso habilita RLS e cria as 4 policies (select/insert/update/delete)
restritas a `organization_id in (select public.current_org_ids())` (mais
`or public.is_current_user_platform_admin()`, para o admin continuar
enxergando tudo). Ver docs/decisoes.md para os detalhes de por que dois
papéis de banco (app vs. migração) e a variável `app.current_user_id`.

## Auth

`core/auth.ts#withOrg()` é o ponto de entrada de toda Server Action/query
de módulo — resolve sessão + organização ativa e devolve
`{ organizationId, userId, role, impersonating, log, withDb }`. Toda
consulta a uma tabela com RLS passa por `withDb(fn)`:

```ts
const { organizationId, withDb, log } = await withOrg();
log.info("modulo.acao");
return withDb((tx) =>
  tx.query.exemplo.findMany({ where: eq(exemplo.organizationId, organizationId) }),
);
```

`core/admin-auth.ts#requireAdmin()` é o equivalente para `/admin` —
mesmo padrão (`withDb`), mas sem filtro de organização (o admin enxerga
tudo via a policy `is_current_user_platform_admin()`).

## Painel do dono da plataforma (`/admin`)

Bloquear/desbloquear organização, cobrança manual, ligar/desligar módulo
por organização (`organization_module_settings`), apagar organização
(confirmação por nome digitado), audit log (`core/admin/audit.ts`),
suporte ao vivo via rrweb + Supabase Realtime Broadcast
(`core/live-support/`) e notificações da plataforma
(`core/notifications/`). Ver docs/decisoes.md e o histórico de armadilhas
do rrweb/Realtime documentado ali.

Impersonation (`core/impersonation.ts`): cookie httpOnly guardando só o
`organizationId`, expira em 2h, sempre logado com o `userId` real do
admin + `impersonating: true`.

## Contrato de módulo

Ver `src/modules/README.md` — arquivo por arquivo, regra de acoplamento
entre módulos, e a regra de que `businessType` nunca é lido por um
módulo.

## Convenções de código

- Dinheiro sempre em centavos (`Cents`, `core/money.ts`), nunca float.
- `ActionResult` padronizado em toda Server Action.
- Validação única via Zod, compartilhada entre form e Server Action.
- Logger estruturado (`core/logger.ts`), nunca `console.*` direto — o
  ESLint bloqueia fora desse arquivo. `redact()` remove campos sensíveis
  antes de logar.
- Ícones lucide-react guardados como string `iconName`, nunca componente
  (serialização Server → Client Component).
- `@tanstack/react-table` não é usado — tabelas shadcn puras.

## Deploy

Preparado para Vercel, região `gru1` (`vercel.json`). `api/health` para
monitoramento externo. `api/cron/backup` protegido por `CRON_SECRET`,
agendado via `vercel.json` (`crons`). Nenhum projeto Supabase real está
vinculado a este template — quem nascer um vertical daqui cria o próprio
projeto Supabase e preenche `.env.local` a partir de `.env.example`.

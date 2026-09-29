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
│   ├── (auth)/
│   │   ├── login/                    # login (Supabase Auth)
│   │   └── trocar-senha-obrigatoria/ # gate de troca de senha (ver core/profile/)
│   ├── (app)/              # área autenticada da organização
│   │   ├── layout.tsx      # shell: sidebar, header, live-support, notificações
│   │   ├── page.tsx        # dashboard-shell (placeholders — sem módulo ainda)
│   │   ├── perfil/         # módulo Perfil (nome, tema, senha, branding)
│   │   └── backup/         # backup/restore por organização
│   ├── (admin)/admin/      # painel do dono da plataforma
│   └── api/                # health check, cron de backup
├── core/                   # fundação — nunca conhece um módulo específico
│   ├── auth.ts             # getSession, getActiveOrg, withOrg, mustChangePassword
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
│   ├── profile/            # perfil pessoal (nome, senha) + branding da org (cor, logo)
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

## Troca de senha obrigatória e Perfil (`core/profile/`)

`must_change_password` (`app_metadata` do usuário Supabase, só gravável
via Admin API) é setado quando o dono da plataforma cria uma organização
com senha inicial (`core/admin/actions.ts#createOrganization`) ou reseta
a senha de alguém (`#resetMemberPassword`). `app/(app)/layout.tsx` e
`app/(admin)/admin/layout.tsx` checam essa flag via
`core/auth.ts#mustChangePassword(user)` e redirecionam para
`/trocar-senha-obrigatoria` antes de qualquer outra coisa. A troca de
senha (`core/profile/actions.ts#setNewPassword`) zera a flag pelo Admin
API depois de `supabase.auth.updateUser({ password })`.

`app/(app)/perfil/` reúne: nome de exibição e senha (`user_metadata`,
qualquer pessoa edita a própria), tema claro/escuro (`next-themes`, só
no navegador, sem persistir no backend) e, só para `role === "owner"`,
a cor primária e o logo da organização (`organizations.primaryColor`/
`logoUrl`, aplicados no shell do app para toda a equipe — ver
`core/profile/actions.ts#updateOrganizationBranding`). O logo é
enviado para o bucket público `branding` do Supabase Storage, criado de
forma idempotente pela própria action.

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

## Verticais e sincronização de fundação

Cada vertical (Prisma, mecano-erp, ...) é um clone deste template que já
tem seus próprios módulos de negócio. Pra evitar que uma correção na
fundação (auth, RLS, admin, backup genérico, perfil, branding...) precise
ser feita manualmente em cada um, existe uma automação bidirecional via
hook `post-commit` (`scripts/install-sync-hook.sh`), guiada por uma lista
única de arquivos: `scripts/foundation-paths.sh` (`FOUNDATION_PATHS`).

**Como funciona, na prática**: comitar normalmente em qualquer um dos
projetos (BaseERP, Prisma ou um vertical futuro). Se o commit tocou um
arquivo que está em `FOUNDATION_PATHS`, o hook propaga sozinho:

- Commit no **BaseERP** → copia pra **todo mundo** listado em
  `scripts/verticals.txt`, um commit automático (`sync(base-erp): ...`)
  por vertical.
- Commit num **vertical** → copia só de volta pro **BaseERP**, um commit
  automático (`sync(<vertical>): ...`) lá.
- Nunca vertical → vertical direto: sempre passa pelo BaseERP primeiro
  (dois commits automáticos em sequência, cada um pedindo revisão e
  `npm run check` antes do `push`, que **nunca é automático**).
- Arquivos de `src/modules/<modulo>/` nunca entram nessa lista — são a
  parte que deveria mesmo divergir entre verticais, o hook nem olha pra
  eles.

**Exceção por vertical** (`VERTICAL_PATH_EXCLUDES`, no mesmo
`foundation-paths.sh`): quando um arquivo geralmente é fundação mas tem
uma divergência REAL de comportamento só num vertical específico (ex.:
mecano-erp tem service worker próprio, texto de UI voltado a "oficina"
em vez de "organização"), ele entra nessa lista em vez de virar uma
edição manual toda vez que o hook tentar igualar — nunca sincroniza
naquele vertical específico, em nenhum sentido, mas continua servindo os
outros normalmente. Ver `docs/decisoes.md`, 2026-09-29, para o caso real
que motivou isso (um texto vazou do mecano-erp pro BaseERP antes dessa
exceção existir).

### Criando um vertical novo

1. `cp -r base-erp <novo-projeto>`, tirar o `.git` de dentro e iniciar um
   repositório novo — isso já traz toda a fundação pronta, sem nenhum
   módulo de negócio.
2. Criar os módulos de negócio em `src/modules/<modulo>/`, seguindo
   `src/modules/README.md` (inclui chamar `registerModule`/
   `registerBackupTable` no próprio `module.ts`).
3. Preencher `src/core/brand.ts` (nome, cor, ícone, tagline) — o único
   arquivo de fundação que NUNCA sincroniza de propósito
   (`FOUNDATION_EXCLUDE_PATHS`), é o que diferencia cada projeto.
4. Adicionar o caminho absoluto do projeto novo numa linha em
   `base-erp/scripts/verticals.txt` e rodar
   `base-erp/scripts/install-sync-hook.sh` de novo — instala o hook nos
   dois sentidos pro projeto novo, que a partir daí entra no mesmo ciclo
   de sincronização automática dos outros.
5. Se algum arquivo específico dele precisar divergir de propósito da
   fundação, adicionar a entrada dele em `VERTICAL_PATH_EXCLUDES`, com o
   mesmo critério: só exceção quando a diferença é de propósito, nunca
   força do hábito/cópia desatualizada.

## Deploy

Preparado para Vercel, região `gru1` (`vercel.json`). `api/health` para
monitoramento externo. `api/cron/backup` protegido por `CRON_SECRET`,
agendado via `vercel.json` (`crons`). Nenhum projeto Supabase real está
vinculado a este template — quem nascer um vertical daqui cria o próprio
projeto Supabase e preenche `.env.local` a partir de `.env.example`.

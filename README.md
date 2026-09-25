# BaseERP

**Este é um projeto-TEMPLATE, não uma aplicação final.** É a fundação
multi-tenant de um ERP modular — autenticação, tenancy, RLS, painel do
dono da plataforma, backup, notificações, suporte ao vivo — sem nenhum
módulo de negócio. Um vertical de negócio (ex.: um ERP para uma empresa
de bordados) nasce clonando este projeto e adicionando seus próprios
módulos em `src/modules/` (contrato documentado em
`src/modules/README.md`).

Ver `docs/README.md` para a documentação viva (arquitetura, decisões
técnicas).

## Stack

- Next.js 16 (App Router), TypeScript strict, Tailwind CSS v4
- shadcn/ui sobre [Base UI](https://base-ui.com) (não Radix — ver
  `components.json`)
- Supabase (Auth + Postgres) via `@supabase/ssr` e `drizzle-orm`
- React Hook Form + Zod
- Vitest + Testing Library + Playwright
- ESLint 9 (flat config) + Prettier + Husky/lint-staged

## Setup

1. `npm install`
2. Copie `.env.example` para `.env.local` e preencha com os dados do seu
   próprio projeto Supabase (não há projeto vinculado a este template —
   crie um novo em https://supabase.com/dashboard).
3. Rode as migrations: `npm run db:migrate` — aplica as migrations do
   drizzle-kit e, em seguida, as migrations custom (`src/db/migrations-custom/`),
   que criam o papel `base_erp_app` (RLS ativa — ver docs/decisoes.md),
   as funções de RLS e as policies. Use `DATABASE_MIGRATION_URL`
   (conexão privilegiada, dona das tabelas) para isso — ver
   `.env.example`.
4. Rode o seed: `npm run db:seed` — cria a primeira organização, o
   primeiro usuário e registra o dono da plataforma.
5. `npm run dev`

## Configurando o banco (RLS ativa)

Diferente do projeto de referência (mecano-erp), aqui a RLS é a proteção
ativa desde o início, não só defesa em profundidade — ver
docs/decisoes.md, "RLS ativa desde o início". Isso exige DOIS papéis de
conexão Postgres:

- **Migração** (`DATABASE_MIGRATION_URL`): o papel padrão/dono do
  projeto Supabase (`postgres`), usado só por `npm run db:migrate` /
  `db:generate` / `db:studio`.
- **Aplicação** (`DATABASE_URL`): o papel `base_erp_app`, criado pela
  primeira migration custom (`0000_app_role.sql`) — sem `bypassrls`, sem
  ser dono de nenhuma tabela. É esse papel que a aplicação usa em
  runtime (`core/db.ts`).

Em ambiente local de teste sem essa separação (ex.: um Postgres onde
você só tem um usuário disponível), o app funciona, mas a RLS não fica
de fato isolada — o dono de tabela ignora RLS por padrão no Postgres.
Rode `src/core/__tests__/rls-isolation.integration.test.ts` contra um
Postgres com os dois papéis configurados para confirmar o isolamento de
verdade (o teste documenta os passos no topo do arquivo).

### Passo a passo com um projeto Supabase real

1. Crie o projeto em [supabase.com](https://supabase.com) (região
   `sa-east-1`, São Paulo).
2. Em **Project Settings -> API**, copie `Project URL`, `anon public` key
   e `service_role` key para `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.
3. Em **Project Settings -> Database -> Connection string -> URI**, copie
   a **Direct connection** (porta 5432, host `db.<ref>.supabase.co`) para
   `DATABASE_MIGRATION_URL` E, temporariamente, também para
   `DATABASE_URL` (vamos trocar no passo 5).
4. Rode `npm run db:migrate` — aplica as migrations do Drizzle e as
   migrations custom, incluindo `0000_app_role.sql`, que cria o papel
   `base_erp_app` (sem senha ainda).
5. Defina uma senha para o papel de aplicação (no **SQL Editor** do
   Supabase, ou via `psql` na direct connection):
   ```sql
   alter role base_erp_app with password '<senha forte, diferente da do postgres>';
   ```
   Troque `DATABASE_URL` para o **pooler em modo Transaction** (porta
   6543, host `aws-0-<região>.pooler.supabase.com`) com esse papel —
   **atenção ao formato do username**: o pooler (Supavisor) exige o
   project ref como sufixo, `base_erp_app.<project-ref>`, não só
   `base_erp_app` (sem o sufixo a conexão falha com
   `FATAL: no tenant identifier provided`; validado contra um projeto
   real em 2026-09-24, ver `docs/decisoes.md`).
6. Rode `npm run db:seed` para criar a primeira organização/usuário e se
   tornar o primeiro `platform_admin`.
7. Valide o isolamento de verdade antes de confiar com dados reais:
   ```bash
   DATABASE_URL="postgresql://base_erp_app.<ref>:<senha>@aws-0-<região>.pooler.supabase.com:6543/postgres" \
   NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co" \
   SUPABASE_SERVICE_ROLE_KEY="<service role key>" \
   npx vitest run rls-isolation
   ```
   O teste cria e apaga usuários reais via Admin API — nunca rode isto
   contra um projeto com dados de clientes de verdade.

## Scripts

| Script                                                         | O que faz                                                   |
| -------------------------------------------------------------- | ----------------------------------------------------------- |
| `npm run dev`                                                  | Sobe o servidor de desenvolvimento                          |
| `npm run build` / `start`                                      | Build e start de produção                                   |
| `npm run lint` / `format` / `format:check`                     | ESLint / Prettier                                           |
| `npm run typecheck`                                            | `next typegen && tsc --noEmit` (Next 16 gera tipos de rota) |
| `npm run test` / `test:watch` / `test:coverage`                | Vitest                                                      |
| `npm run test:e2e`                                             | Playwright (`e2e/`)                                         |
| `npm run db:generate` / `db:migrate` / `db:seed` / `db:studio` | Drizzle                                                     |
| `npm run check`                                                | format:check + lint + typecheck + test — rodado no CI       |

## Deploy

Preparado para a Vercel (região `gru1`, ver `vercel.json`), com
`api/health` para monitoramento e `api/cron/backup` (protegido por
`CRON_SECRET`) agendado via `vercel.json`. Nenhum deploy real foi feito a
partir deste template — configure o projeto Vercel + Supabase ao nascer
um vertical.

## Nascendo um vertical a partir deste template

1. Clone/copie este repositório com um nome novo.
2. Crie seu próprio projeto Supabase e preencha `.env.local`.
3. Adicione módulos em `src/modules/<modulo>/` seguindo o contrato em
   `src/modules/README.md`, e registre-os em `src/core/load-modules.ts`.
4. Substitua os KPI cards placeholder de `app/(app)/page.tsx` pelos
   indicadores reais do(s) seu(s) módulo(s).
5. Ajuste a paleta de cores em `src/app/globals.css` para a marca do
   vertical.
6. **Mantenha a regra de manutenção**: qualquer correção feita numa peça
   de core/tenancy/RLS/admin enquanto se trabalha no vertical deve ser
   replicada de volta para este template (ver docs/decisoes.md).

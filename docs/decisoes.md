# Decisões técnicas (por quê)

Log curto, cronológico, estilo ADR. Cada entrada explica uma decisão e o
porquê — o "como" fica no código e em docs/arquitetura.md.

## 2026-09-24 — Stack idêntica ao mecano-erp

BaseERP nasce como o "core" extraído do mecano-erp (ERP de oficina
mecânica do mesmo autor, em produção). A stack é copiada 1:1 — Next.js 16
(App Router), TypeScript strict, Tailwind v4, shadcn/ui sobre Base UI,
Drizzle + Postgres/Supabase, Vitest + Testing Library + Playwright,
ESLint 9 flat config bloqueando `console.*`, Husky + lint-staged — porque
é uma combinação já validada em produção, não uma escolha nova a testar.
Nenhuma peça específica de oficina mecânica (veículos, ordens de serviço
com campos automotivos) foi portada — só a infraestrutura genérica que
qualquer ERP precisa antes de especializar por ramo.

## 2026-09-24 — RLS ativa desde o início (DIVERGE do mecano-erp)

No mecano-erp, a conexão do app usa o papel `postgres` do Supabase, que
tem `bypassrls = true` — RLS ali é só defesa em profundidade; a proteção
real é o filtro manual `organizationId` aplicado por `withOrg()` em toda
query. Aqui a decisão é oposta: **a RLS é a proteção ativa desde o
primeiro commit**, não uma camada "depois eu ligo".

Por quê: este é um template que vai gerar múltiplos verticais de
produção. Cada vertical, ao adicionar um módulo novo, corre o risco de
esquecer um filtro `where(eq(tabela.organizationId, ...))` em alguma
query — um bug clássico de multi-tenant que vaza dado de uma organização
para outra. Com RLS ativa, esse esquecimento vira "a query volta vazia",
nunca "a query volta com dado de outra organização".

Implementação (ver `src/db/migrations-custom/`, `src/core/db.ts`,
`src/core/auth.ts`, `src/core/admin-auth.ts`):

- `src/db/migrations-custom/0000_app_role.sql` cria o papel Postgres
  `base_erp_app` — **sem** `bypassrls`, **sem** ser dono de nenhuma
  tabela. A APLICAÇÃO em runtime (`DATABASE_URL`) deve conectar como esse
  papel. As migrations (`db:migrate`/`db:generate`, via
  `DATABASE_MIGRATION_URL`) rodam com o papel privilegiado que é dono
  das tabelas (ex.: `postgres`, o papel padrão de um projeto Supabase).
- Dono de tabela e superusuário sempre ignoram RLS no Postgres, com ou
  sem `bypassrls`, a não ser que a tabela use `FORCE ROW LEVEL SECURITY`
  — e forçar RLS no dono quebraria as funções `SECURITY DEFINER`
  (`current_org_ids()`, `is_current_user_platform_admin()`) que
  precisam rodar com o privilégio do dono para evitar recursão infinita
  ao consultar `memberships`/`platform_admins` por dentro. Por isso a
  separação em dois papéis (app vs. migração), e não `FORCE ROW LEVEL
SECURITY`.
- Como uma conexão Postgres direta (via `postgres-js`, sem passar pelo
  PostgREST do Supabase) nunca populariza `auth.uid()` de verdade, as
  funções SQL usam uma variável de sessão própria, `app.current_user_id`,
  definida via `set_config('app.current_user_id', $userId, true)` — o
  terceiro argumento `true` (`is_local`) faz o valor sumir sozinho ao
  fim da transação, nunca vazando para a próxima query que reusar a
  mesma conexão física do pool. Ver `core/db.ts#runWithUserContext`.
- `withOrg()` (app) e `requireAdmin()` (`/admin`) não retornam mais um
  `db` cru — retornam `withDb(fn)`, que roda `fn` dentro dessa
  transação com o contexto já definido. Nenhum módulo deve importar
  `core/db.ts#db` direto (ele existe só para `select 1` do health check
  e como base do `db.transaction` usado por `runWithUserContext`).
- O admin (`/admin`) continua enxergando TODAS as organizações — não
  porque a conexão ignora RLS (como no mecano-erp), mas porque as
  policies fazem `... or public.is_current_user_platform_admin()`. A
  proteção real de `/admin` continua sendo `requireAdmin()` rodar antes
  de qualquer query, exatamente como documentado no mecano-erp — só que
  agora reforçada por uma segunda camada (a RLS) em vez de depender só
  dela.
- O cron de backup (`api/cron/backup/route.ts`) não tem sessão de
  usuário nenhuma — usa `core/db.ts#runWithSystemContext`, que define
  `app.is_system = 'true'`, também reconhecido por
  `is_current_user_platform_admin()` como "acesso total". Protegido só
  por `CRON_SECRET` na camada HTTP.
- Teste de integração obrigatório:
  `src/core/__tests__/rls-isolation.integration.test.ts` — cria 2
  organizações e confirma, com um client Postgres direto (não passando
  por `withOrg()`), que a organização A nunca vê linha da organização B.
  Só é significativo rodando com `DATABASE_URL` apontando para o papel
  `base_erp_app` (não o dono) — o teste documenta isso no topo do
  arquivo, e é pulado (nunca falha por omissão) sem `DATABASE_URL`.

## 2026-09-24 — `businessType` como preset não-acoplado

`organizations.businessType` (texto livre, ex.: "bordados") existe só
para a tela de criar organização em `/admin` sugerir um conjunto de
módulos padrão. Nenhum módulo de negócio deve ler este campo — ver o
comentário em `src/db/schema/tenancy.ts` e a regra 10 em
`src/modules/README.md`. Um vertical que precise de comportamento
condicional por ramo deve modelar isso como configuração própria do
módulo, nunca como `if (org.businessType === "x")` espalhado pelo
código — isso acopla o "core" (que deve continuar genérico, reutilizável
por qualquer vertical) a um ramo de negócio específico.

## 2026-09-24 — Módulos vazios nesta fase (Fase 0)

`src/modules/` só tem um `README.md` com o contrato de arquivos — nenhum
módulo de negócio (nem "clientes", que no mecano-erp seria tentador
considerar "genérico o bastante"). A Fase 0 é só a fundação (tenancy,
auth, RLS, admin, backup, notificações, suporte ao vivo); criar o
primeiro módulo de negócio de verdade é trabalho de uma fase seguinte
(ex.: o vertical "Prisma", para uma empresa de bordados).

## 2026-09-24 — Regra de manutenção do BaseERP

Sempre que uma correção ou melhoria for feita numa peça que pertence ao
core/tenancy/RLS/admin **enquanto se trabalha num vertical nascido deste
template**, essa mudança deve ser replicada de volta para o BaseERP. O
template é o ponto de partida de vários projetos — um bug de segurança
encontrado e corrigido num vertical (ex.: uma policy de RLS incompleta)
provavelmente existe em todos os outros nascidos daqui, incluindo o
próprio template.

## 2026-09-24 — `process.env` dinâmico (herdado do mecano-erp)

O Next.js só consegue substituir uma variável `NEXT_PUBLIC_*` pelo valor
real no bundle do navegador quando o código acessa a propriedade
literalmente (`process.env.NEXT_PUBLIC_X`). Um acesso dinâmico por string
(`process.env[name]`, inclusive dentro de `requireEnv(name)`) vira
`undefined` no navegador, silenciosamente, em dev e produção — só quebra
em runtime quando alguém tenta usar o valor. Por isso `core/env.ts`
avisa, em comentário, para nunca usar `requireEnv` com uma variável
`NEXT_PUBLIC_*` consumida no cliente (`core/supabase/client.ts` acessa
`process.env.NEXT_PUBLIC_SUPABASE_URL` direto, não via `requireEnv`).

## 2026-09-24 — `@tanstack/react-table` não é usado (herdado do mecano-erp)

Tabelas usam só os componentes shadcn (`components/ui/table.tsx`) — sem
uma lib de data-grid. As listas deste template (e dos verticais que
nascerem dele) são de porte pequeno/médio (uma organização por vez, não
milhões de linhas), então paginação/ordenação/filtro no servidor (via
querystring, ver `components/search-box.tsx`) resolve sem o peso e a
complexidade de API de uma lib de tabela completa.

## 2026-09-24 — Prisma nasce deste commit; regra de acoplamento ganha uma exceção

`/home/eduardo/code/prisma` foi criado como cópia integral deste
repositório neste commit (`7eff4b8`, "Scaffold inicial do BaseERP") — ver
`prisma/docs/decisoes.md` para o registro espelhado e todas as decisões
específicas do vertical bordados a partir daqui.

Uma correção de documentação feita lá foi replicada para cá (regra de
manutenção em ação): a regra de acoplamento entre módulos (regra 8 de
`src/modules/README.md`) ganhou uma nota de exceção — `schema.ts` de um
módulo pode importar `schema.ts` de outro módulo diretamente (nunca o
barrel), porque o Drizzle exige o objeto `pgTable` real para declarar uma
foreign key. Essa exceção já valia implicitamente (é o mesmo padrão do
mecano-erp), só não estava escrita; descoberta ao implementar
`modules/pedidos/schema.ts` no Prisma, que referencia `modules/clientes/schema`
e `modules/catalogo-bordado/schema` diretamente.

Decisão em aberto do plano, registrada aqui por simetria: o módulo
`clientes` (candidato natural a viver no BaseERP, por ser genérico o
bastante para qualquer ramo) NÃO foi portado para cá ainda — foi criado
direto em `prisma/src/modules/clientes/` (ver a decisão espelhada em
`prisma/docs/decisoes.md`, "Onde o módulo `clientes` foi criado"). Fica
como candidato a promoção para este template quando um segundo vertical
precisar de cadastro de cliente.

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

## 2026-09-24 — RLS validada de verdade contra Postgres real; bug de ordenação corrigido

Até aqui os testes de isolamento por RLS existiam só como código gated por
`DATABASE_URL` (ver `src/core/__tests__/rls-isolation.integration.test.ts`),
nunca executados de fato — os ambientes de implementação anteriores não
tinham Postgres/Docker disponível. Hoje isso foi resolvido montando um
Postgres 16 local sem privilégio de root (baixando o `.deb` oficial do
apt.postgresql.org com `apt-get download` e extraindo com `dpkg-deb -x`,
sem instalar no sistema — `initdb`/`pg_ctl` funcionam normalmente a partir
dos binários extraídos) e simulando o mínimo de Supabase que as migrations
custom esperam (`schema auth` com uma tabela `users`, papéis
`authenticated`/`anon`/`service_role`).

Isso encontrou e corrigiu dois problemas reais que nenhuma leitura de
código pegaria:

1. **Bug de ordenação entre migrations**: `0001_rls_policies.sql` criava
   as policies de `organizations`/`memberships` chamando
   `is_current_user_platform_admin()` diretamente, mas essa função só era
   definida em `0002_platform_admin_rls.sql` (que roda depois). A migration
   falhava com `function ... does not exist` ao aplicar do zero. Corrigido
   movendo a definição da função para `0001`, antes do primeiro uso —
   `platform_admins` (a tabela que a função consulta) já existe nesse ponto
   porque as migrations do drizzle-kit rodam antes de qualquer migration
   custom, então não há dependência circular real, só uma ordem errada
   dentro do próprio arquivo custom.
2. **Teste de isolamento com premissa quebrada**: a primeira versão do
   teste promovia o próprio usuário testado (`userA`) a `platform_admin`
   para poder contornar a policy de bootstrap e criar as organizações de
   teste — mas um platform admin enxerga todas as organizações por
   desenho (`... or is_current_user_platform_admin()` em toda policy).
   Rodado de verdade, o teste falhava (`userA` via a organização B) porque
   estava, sem querer, testando o caminho de admin, não o de isolamento
   entre tenants comuns. Corrigido introduzindo um `adminUserId` dedicado
   só ao setup, nunca usado nas asserções — `userA`/`userB` continuam
   sendo membros comuns, nunca admins.

Com as duas correções, os 3 testes de `rls-isolation.integration.test.ts`
passam de verdade contra Postgres real, e um smoke test manual adicional
(fora deste template, feito no Prisma, que já tem módulos de negócio)
confirmou o mesmo isolamento em `clientes`, `pedidos` e `pedido_itens`
(RLS via join) — ver `prisma/docs/decisoes.md`.

**Lição para quem mantiver este template**: escrever um teste de
integração gated por `DATABASE_URL` não é suficiente por si só — ele
precisa ser executado pelo menos uma vez contra um banco real antes de
confiar na proteção que ele afirma provar. Um teste nunca executado pode
esconder tanto um bug na migration quanto um bug no próprio teste.

## 2026-09-24 (cont.) — Teste de RLS reescrito para usar Admin API; bug de connection string do pooler

A validação anterior (mesma data, entrada acima) foi feita contra um
Postgres vanilla local — bom o bastante para achar o bug de ordenação
entre migrations, mas escondeu dois problemas que só apareceram ao rodar
contra um projeto Supabase real de verdade (`prisma-bordados`):

1. **`auth.users` real recusa insert direto**: `permission denied for
table users` — a tabela é gerenciada só pelo GoTrue/Auth do Supabase,
   nem o dono do banco escreve nela à mão (diferente do meu Postgres
   vanilla local, onde eu mesmo criei a tabela e dei `grant insert`).
   `rls-isolation.integration.test.ts` foi reescrito para criar os
   usuários de teste via `supabaseAdmin.auth.admin.createUser` (Admin
   API, mesmo padrão de `src/db/seed.ts`), e apagá-los no `afterAll` via
   `auth.admin.deleteUser`. O teste agora é gated por 3 variáveis
   (`DATABASE_URL` + `NEXT_PUBLIC_SUPABASE_URL` +
   `SUPABASE_SERVICE_ROLE_KEY`), não só `DATABASE_URL`.
2. **Formato do username no pooler**: `postgresql://base_erp_app:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`
   falha com `FATAL: no tenant identifier provided (external_id or
sni_hostname required)`. O pooler (Supavisor) do Supabase precisa do
   project ref como sufixo do username:
   `base_erp_app.<project-ref>`. `.env.example` e o README ("Configurando
   o banco") foram corrigidos com essa observação — o exemplo anterior
   (copiado de memória, nunca validado contra um Supabase real) estava
   errado.

Com as duas correções, validei de ponta a ponta contra o projeto Supabase
real do Prisma (aplicação das migrations, definição de senha do papel de
app, conexão via pooler, e o teste de isolamento passando com usuários
reais criados/apagados via Admin API) — ver `prisma/docs/decisoes.md`
para o detalhe da execução.

**Lição reforçada**: "testado contra um Postgres" não é o mesmo que
"testado contra Supabase" — `auth.users` real tem permissões e o pooler
tem um formato de conexão que só aparecem com um projeto de verdade.

## 2026-09-25 — Três peças universais adicionadas, descobertas testando o Prisma no navegador

Testar o Prisma de verdade no navegador (não só os testes automatizados)
achou peças que faltavam no BaseERP e que qualquer vertical futuro vai
precisar — trazidas pra cá seguindo a regra de manutenção deste template:

- **`components/action-link.tsx`** — padrão de todo link de linha de
  tabela (cor primária sem sublinhado fixo, ícone que desliza no
  hover/foco dizendo o que o clique faz), portado do mecano-erp. Usar em
  vez de `<Link className="hover:underline">` em qualquer lista nova.
- **`components/list-filter-bar.tsx`** — barra de filtro (um select por
  dimensão filtrável) + ordenação, também do mecano-erp, 100% genérica
  (lê/escreve searchParams da própria página). Convenção de uso: cada
  módulo exporta `<MODULO>_SORT_OPTIONS` do seu `queries.ts` (ver
  `src/modules/README.md`).
- **`components/stale-service-worker-cleanup.tsx`** — corrige um
  problema real de dev: um service worker registrado por outro projeto
  (ex. mecano-erp, que tem um de verdade) na mesma porta local fica
  associado à origem do navegador e serve conteúdo em cache do projeto
  errado. Este template ainda não tem service worker próprio — plugado
  no `layout.tsx` raiz, desregistra qualquer um encontrado ao montar.
  Remover/ajustar quando este projeto ganhar seu próprio PWA/offline.

## 2026-09-25 — `registerModule` vira upsert por `slug` (bug de HMR)

Achado no Prisma (vertical nascido deste template), enquanto se
trabalhava no módulo `clientes` (feature de LGPD): erro do React em dev
— "Encountered two children with the same key, `clientes`" no
`sidebar-nav.tsx`. Causa: `registerModule` (`core/registry.ts`) fazia só
`MODULES.push(definition)` num array module-level. Em dev, o Fast Refresh
do Turbopack pode reavaliar `core/load-modules.ts` (por causa de um edit
em qualquer arquivo que ele importa, direto ou transitivo) sem reiniciar
o processo Node — cada `modules/<modulo>/module.ts` roda de novo, e um
`push` puro empilha o mesmo módulo de novo a cada reavaliação, sem
limite, pelo tempo de vida do processo `next dev`.

Não quebra produção (processo novo por deploy, import único), só dev —
mas é fragilidade real: qualquer sessão de trabalho editando
`modules/*/module.ts` (ou algo que ele importe) acumula duplicatas.
Corrigido trocando `push` por um upsert (`findIndex` por `slug`,
substitui se já existir). Replicado aqui pela regra de manutenção — ver
`prisma/docs/decisoes.md`, mesma data.

## 2026-09-28 — Troca de senha obrigatória + módulo Perfil (nome, tema, branding da organização)

Peça pedida pelo dono da plataforma: quando ele cria uma organização em
`/admin` com um e-mail e senha inicial, quem entra com essa senha precisa
ser obrigado a trocá-la antes de acessar qualquer outra tela; se
esquecer a senha depois e não conseguir recuperar sozinha, ele (dono da
plataforma) precisa poder resetar sem apagar nada que a pessoa já tinha
cadastrado; e cada pessoa ganha um módulo Perfil (nome de exibição, tema
claro/escuro) — quem é `role === "owner"` da própria organização também
configura ali a cor primária e o logo que aparecem pra toda a equipe
dela (branding do cliente que usa o sistema, não do dono da plataforma).

Decisões de onde guardar cada dado (nenhuma tabela nova de "usuários" —
mantém o padrão já existente de não modelar `auth.users` no Drizzle):

- **`must_change_password`** vai em `app_metadata` do usuário Supabase —
  só editável via Admin API (service role), nunca pelo próprio usuário
  através do client SDK (`user_metadata` seria self-editável e não
  serviria pra um portão de segurança). Setado por
  `core/admin/actions.ts#createOrganization` (usuário novo, senha
  inicial) e `#resetMemberPassword` (reset pelo dono da plataforma — ver
  abaixo), zerado por `core/profile/actions.ts#setNewPassword` depois
  que a pessoa define senha própria.
- **`display_name`** vai em `user_metadata` — a própria pessoa edita via
  `supabase.auth.updateUser({ data: { display_name } })`.
- **Tema claro/escuro**: resolvido só no navegador via `next-themes`
  (`components/theme-provider.tsx`, plugado no `layout.tsx` raiz) — as
  variáveis CSS pra `.dark` já existiam em `globals.css` desde sempre,
  mas nenhum `ThemeProvider` estava plugado em lugar nenhum (confirmado
  também no mecano-erp e no prisma — nenhum dos três tinha dark mode
  funcional). Não sincronizado em `user_metadata`: seria
  over-engineering pra uma preferência de navegador, `next-themes`
  sozinho já resolve sem flash (FOUC).
- **`primaryColor`/`logoUrl`** são colunas novas em `organizations`
  (nullable, mesmo padrão de `businessType`/`billingNotes`) — a tabela
  já tem RLS (`apply_org_rls`), então é só migration comum do
  drizzle-kit, sem SQL custom novo. Só quem tem `role === "owner"` edita
  — checado em `core/profile/actions.ts#updateOrganizationBranding`, não
  em RLS separada (mesmo padrão de "permissão checada na action" do
  resto de `core/admin`).
- **Upload do logo**: primeiro uso de Supabase Storage neste projeto
  (nenhum dos três usava até agora). Bucket público `branding`, criado
  de forma idempotente pela própria action
  (`storage.createBucket(..., { public: true })`, ignorando erro de "já
  existe" — sem passo manual de setup no README). Upload feito com o
  client admin depois de confirmar `role === "owner"` no código, sem RLS
  de Storage separada.
- **Onde barrar quem precisa trocar senha**: nos layouts
  (`app/(app)/layout.tsx` e `app/(admin)/admin/layout.tsx`), não no
  `proxy.ts` — ambos chamam `getSession()` + `core/auth.ts#mustChangePassword`
  antes de `getActiveOrg()`/`requireAdmin()` e redirecionam para
  `/trocar-senha-obrigatoria` (reaproveita o layout de `(auth)/`, que não
  tem lógica de "esconder de quem já está logado" — seguro de reusar).
- **Perfil não é um módulo de `src/modules/`**: o contrato de
  `src/modules/README.md` é para módulos de negócio pluggáveis por
  organização (toggle em `organization_module_settings`); Perfil é
  sempre-ligado. Fica em `core/profile/`, mesmo padrão de
  `core/live-support`/`core/notifications`/`core/admin`.
- **Reset de senha pelo dono da plataforma**
  (`core/admin/actions.ts#resetMemberPassword`,
  `core/admin/components/reset-member-password-button.tsx`): o `prisma`
  (vertical nascido deste template) já tinha essa peça — construída lá
  antes de existir aqui, fora da regra de manutenção porque na época não
  fazia parte de nenhuma entrega core explícita. Trazida agora pra cá
  (com um ajuste: também marca `must_change_password`, o que o prisma
  ainda não fazia — corrigido lá também, ver `prisma/docs/decisoes.md`,
  mesma data). Gera uma senha provisória aleatória
  (`generateTemporaryPassword()`, alfabeto sem caracteres ambíguos:
  0/O, 1/l/I), mostrada uma única vez num dialog — nunca fica salva em
  lugar nenhum além do que o admin copiar/repassar.

**Fora de escopo, por decisão consciente**: não portei o fluxo de
autoatendimento "Esqueci minha senha" (e-mail) do prisma pra cá — o
pedido cobria troca obrigatória + reset pelo dono da plataforma, que já
resolve "usuário esqueceu e não consegue recuperar". Fica como próximo
passo natural, usando o prisma como referência
(`app/(auth)/actions.ts#requestPasswordReset`, `/esqueci-senha`,
`/redefinir-senha`).

## 2026-09-28 (cont.) — `core/user-lookup.ts`: nome de exibição em vez de UID cru em `/admin`

Bug reportado depois da entrega acima: "Pessoas com acesso" e o
"Histórico" (auditoria) na ficha de uma organização mostravam o UUID cru
do usuário sempre que o lookup de `email` em `auth.users` não resolvia
bem o suficiente pra leitura — na prática, sempre que a pessoa não tinha
e-mail cadastrado de um jeito legível ali. Três lugares faziam a mesma
consulta SQL bruta contra `auth.users` e o mesmo fallback pro UID
(`core/admin/queries.ts#getOrganizationForAdmin` duas vezes — membros e
auditoria — e `core/notifications/queries.ts#getNotificationForAdmin`,
"quem leu").

Extraído para `core/user-lookup.ts#getUserDisplayInfoByIds` — único
lugar que lê `auth.users` por uma lista de ids e devolve
`{ email, name }`, com `name` sendo `display_name` (`user_metadata`,
`core/profile/`) quando a pessoa já passou por `/perfil`, senão o
e-mail, senão o próprio UID (nunca fica sem nenhum rótulo). Os três
lugares acima passaram a usar esse helper em vez de montar a query e o
fallback na mão — reduz de 3 cópias praticamente idênticas pra 1.

`ResetMemberPasswordButton` também mudou: a prop `email` virou `label`
(recebe o nome de exibição, não necessariamente um e-mail) — os textos
do dialog já eram genéricos o bastante pra não precisar mudar.

## 2026-09-28 (cont.) — Branding (cor/logo) nunca persistia: faltava policy de UPDATE pro owner em `organizations`

Bug reportado em produção (testado no prisma): salvar cor/logo em
`/perfil` mostrava sucesso, mas nada mudava — nem a cor nos botões, nem
o logo na sidebar. Causa raiz: `organizations` só tinha a policy
`organizations_admin_write` (RLS ativa, só platform admin —
0001_rls_policies.sql), então o `UPDATE` da Server Action batia
sistematicamente em **0 linhas**, sem erro nenhum (RLS bloqueia
silenciosamente) — e a action não checava `rowCount`/`.returning()`,
então via aquilo como sucesso.

Corrigido em duas frentes:

1. **`migrations-custom/0005_organizations_owner_branding.sql`** — nova
   função `current_owner_org_ids()` (como `current_org_ids()`, mas
   filtrando `role = 'owner'` — a existente não distingue staff de
   owner) + policy `organizations_owner_update_branding` liberando
   UPDATE pra quem é owner da própria organização. Como é o MESMO papel
   de banco que atende admin e owner (não dá pra restringir por coluna
   só com `GRANT`), um trigger (`restrict_organization_branding_update`)
   rejeita qualquer mudança fora de `primary_color`/`logo_url`/
   `updated_at` quando quem edita não é platform admin — sem isso, um
   owner poderia chamar a API do Supabase direto (fora do Next.js,
   ignorando a checagem `role !== "owner"` da action) e tentar mudar
   `status`/cobrança da própria organização.
2. **`core/profile/actions.ts#updateOrganizationBranding`** — passou a
   usar `.returning()` e checar se veio alguma linha; se não veio,
   devolve erro em vez de "sucesso" — rede de segurança pra nunca mais
   esconder um bloqueio de RLS como se fosse sucesso.

Também trocada a forma de aplicar a cor no app: em vez de `style`
inline num `<div>` (dependia de como o Tailwind v4 compila
`@theme inline` — incerto o bastante pra não confiar sem testar contra
produção), `components/org-branding-style.tsx` injeta um
`<style>:root{--primary:...}</style>` — aplica no elemento raiz do
documento de verdade, sem depender de indireção de variável CSS em
elemento aninhado. Revalida o formato hex de novo antes de interpolar
(nunca montar CSS bruto a partir de um valor do banco sem checar, mesmo
que a origem seja validada no input).

Cabeçalho do app também passou a mostrar `user_metadata.display_name`
(fallback: e-mail) no menu da pessoa, em vez do e-mail cru — pedido
direto depois de testar em produção.

"Pessoas com acesso" e "Histórico" (auditoria) em `/admin` passaram a
mostrar nome **e** código (UUID) juntos — o pedido inicial (replicar
nome amigável) tirou o UUID de vez, mas o dono da plataforma preferiu
manter os dois visíveis (útil pra achar alguém no dashboard do Supabase
por exemplo).

## 2026-09-28 (cont.) — `core/brand.ts`: extração do que diferencia cada vertical + automação real de sincronização

Pedido explícito do dono da plataforma: a regra de manutenção (entrada
de 2026-09-24 acima) até então era só um princípio manual — "lembre de
replicar". A partir daqui existe automação de verdade entre este
template e o `prisma` (o `mecano-erp` fica de fora por enquanto, por
pedido explícito, porque usa uma arquitetura de RLS diferente —
`bypassrls`/`db` direto em vez de `withDb`/RLS ativa — e precisaria de
adaptação, não cópia direta).

**Pré-requisito**: pra um arquivo poder ficar byte-idêntico entre
BaseERP e um vertical, o único conteúdo que realmente diferencia um
vertical do outro (nome, tagline, cor de marca, ícone, link de política
de privacidade) precisou sair dos arquivos de layout/metadata pra um
único lugar: `src/core/brand.ts` (interface `BrandConfig` — `name`,
`tagline`, `primaryHex`, `iconPaths: string[]`, `privacyPolicyHref?`) +
`src/components/brand-icon.tsx` (renderiza um `<svg>` a partir de
`BRAND.iconPaths`, componente genérico). Isso tornou
`app/(app)/layout.tsx`, `app/(auth)/login/page.tsx`, `app/icon.tsx`,
`app/apple-icon.tsx`, `app/opengraph-image.tsx` e `app/layout.tsx`
(metadata raiz) byte-idênticos entre os dois projetos — `core/brand.ts`
em si é o único arquivo que nunca sincroniza (fica na lista de exclusão
tanto do script de comparação quanto do de sincronização).

**Mecanismo** (`scripts/` deste repo):

- `check-drift.sh` (já existia) — só compara e lista divergência, nunca
  aplica nada. Serve pra auditoria manual pontual.
- `sync-to-vertical.sh <caminho-do-vertical> [arquivos...]` — sincroniza
  de verdade (copia/`rsync --delete`, e apaga no vertical o que foi
  apagado aqui), reusando a mesma lista `FOUNDATION_PATHS`. Sem lista de
  arquivos, sincroniza tudo; com lista, só o que foi passado. Só copia e
  dá `git add` no vertical — nunca commita nem dá push sozinho.
- `sync-foundation-commit.sh` — lógica do hook: olha o que o commit que
  acabou de rodar em `HEAD` tocou (`git diff-tree`), filtra pro que cai
  dentro de `FOUNDATION_PATHS`, e se algo bateu, roda
  `sync-to-vertical.sh` pra cada linha de `scripts/verticals.txt`
  (arquivo simples, um caminho absoluto por linha) e **commita
  localmente** no vertical (mensagem `sync(base-erp): <assunto do
commit original>`, referenciando o SHA). Não faz nada se o commit não
  tocou fundação.
- `install-sync-hook.sh` — escreve `.husky/post-commit`. **Correção
  importante**: a primeira versão escrevia em `.git/hooks/post-commit`,
  que NUNCA dispara neste projeto — `core.hooksPath` aponta pra
  `.husky/_` (Husky gerencia os hooks), então qualquer coisa em
  `.git/hooks/` é ignorada silenciosamente. Corrigido pra escrever em
  `.husky/post-commit` (formato Husky v9: script puro, sem o
  boilerplate antigo `. "$(dirname -- "$0")/_/husky.sh"`, que o próprio
  Husky marca como removido no v10). Diferente de `.git/hooks/`,
  `.husky/` é versionado — o arquivo gerado fica no git, mas o
  instalador continua idempotente (rodar de novo só reescreve).

**Decisão consciente de onde o automático para**: o hook commita local
no vertical, mas **nunca dá `git push`** — um push dispara deploy em
produção (Vercel, no caso do prisma) e é uma ação que afeta sistema
compartilhado; a regra geral deste projeto (ver `AGENTS.md`) trata isso
como ação que sempre passa por confirmação explícita, mesmo com a
automação de sincronização ligada. O fluxo esperado depois de um commit
que mexeu em fundação: o hook já deixou o commit pronto no vertical →
rodar `npm run check` lá → revisar → dar push manual.

**Por que hook local de `post-commit` e não GitHub Actions**: um
workflow cross-repo (BaseERP → prisma) precisaria de um PAT/deploy key
novo com permissão de escrita no repo do prisma, secret que não existe
hoje neste ambiente; o hook local reusa as credenciais de git já
configuradas na máquina de desenvolvimento, sem superfície nova de
segredo. Troca: só sincroniza quando alguém commita a partir desta
mesma máquina — aceitável pro estágio atual (um único
desenvolvedor/máquina).

**Dois bugs reais encontrados testando o próprio mecanismo antes de
confiar nele** (a lição maior desta entrega — testar a automação de
verdade contra o Prisma real, não só ler o script, achou os dois):

1. **`rsync -a --delete` numa pasta inteira apaga o que só existe no
   vertical**: a primeira versão tratava `FOUNDATION_PATHS` com
   entradas de DIRETÓRIO amplo (`src/core` inteiro, `src/app/(admin)`
   inteiro, `src/app/(auth)` inteiro) e usava `--delete` pra manter o
   destino idêntico à origem. Rodar de verdade contra o Prisma
   apagaria `core/privacy/`, `core/business-type-presets.ts` e
   `core/audit-log.ts` — arquivos que só existem no Prisma, sem
   equivalente no BaseERP. Corrigido removendo `--delete` do
   `sync-to-vertical.sh`.
2. **Diretório inteiro sincronizado também SOBRESCREVE arquivos que têm
   o mesmo nome nos dois projetos mas legitimamente DIVERGEM**: mesmo
   sem `--delete`, sincronizar `src/core` inteiro porque um único
   arquivo dentro dele mudou (ex.: só `core/auth.ts`) copiava TODO o
   conteúdo de `src/core` do BaseERP por cima do Prisma — sobrescrevendo
   `core/admin/actions.ts` (tem lógica de cascata de tabelas de negócio
   que só existe no Prisma), `core/registry.ts`/`core/logger.ts` (
   comentários e padrões que já divergiram entre os dois),
   `core/live-support/*`, páginas de `(admin)` com polish mobile
   específico do Prisma, `components/layout/mobile-nav.tsx` (nome do
   vertical hardcoded — "Prisma" virava "BaseERP") e
   `components/layout/sidebar-nav.tsx` (o item de menu de LGPD, que só
   o Prisma tem, desaparecia). Testado num sync real contra o
   `/home/eduardo/code/prisma`, revertido manualmente (`git restore
--staged --worktree`) antes de qualquer commit chegar a acontecer.

**Correção estrutural, não só um patch**: `FOUNDATION_PATHS` deixou de
misturar diretórios amplos com arquivos — virou `scripts/foundation-paths.sh`,
fonte única (`source`ada por `sync-to-vertical.sh` e
`sync-foundation-commit.sh`), file-level por padrão. Só entra um
diretório inteiro na lista depois de confirmar com `diff -rq` que os
dois lados são IDÊNTICOS agora (ex.: `core/profile/`, sem nenhuma
lógica de negócio, sem histórico de divergência) — nunca por suposição.
`sync-foundation-commit.sh` também passou a propagar o ARQUIVO exato
que o commit tocou (não a entrada inteira de `FOUNDATION_PATHS` que ele
casou), reforçando o mesmo princípio: nunca sincronizar mais do que o
commit realmente mudou. Divergência legítima conhecida (listada em
comentário no topo de `foundation-paths.sh`) fica de fora da automação
de propósito — continua só no `check-drift.sh`, pra revisão manual.

**Lição pra quem mexer nesta automação depois**: "parece óbvio que essa
pasta deveria ficar idêntica" não é o mesmo que "está confirmado que
está idêntica agora". Um vertical maduro (o Prisma já tem meses de
desenvolvimento próprio) acumula divergência legítima até em arquivos
que nasceram idênticos — automação de sincronização de fundação só é
segura no nível de granularidade que alguém efetivamente verificou.

## 2026-09-28 (cont.) — Terceiro bug real: `core/brand.ts` do Prisma foi sobrescrito pelo do BaseERP

Reportado pelo dono da plataforma depois do commit automático ter ido
pra produção: a logo/nome mostrados no Prisma viraram os do BaseERP
("BaseERP" + ícone de prédio em vez de "Prisma" + ícone de gema).

**Causa raiz**: no teste inicial do mecanismo (mesma sessão, ver entrada
acima "Dois bugs reais..."), quando `src/core` ainda era sincronizado
como diretório inteiro, `core/brand.ts` do Prisma (que JÁ tinha conteúdo
próprio — nome, cor, ícone do Prisma — criado antes da automação
existir) foi sobrescrito pela cópia do BaseERP. `is_excluded()` só
filtrava a entrada de `FOUNDATION_PATHS`/`TO_SYNC` em si (ex.:
`"src/core/brand.ts"` como entrada própria) — nunca impedia que um
arquivo excluído fosse copiado por TABELA quando estava dentro de um
diretório sincronizado por inteiro (`rsync -a "$base/src/core/"
"$target/src/core/"` copia TUDO dentro, `core/brand.ts` incluso, sem
nenhum `--exclude` real passado pro `rsync`).

Na hora de reverter manualmente os arquivos sobrescritos por aquele
teste (`git restore --staged --worktree <lista de arquivos>`),
`core/brand.ts` foi ESQUECIDO da lista — porque era um arquivo NOVO
(nunca commitado antes daquela sessão), `git restore` não teria uma
versão de `HEAD` pra restaurar mesmo se eu tivesse lembrado de incluí-lo
(diferente dos outros arquivos revertidos, que já existiam em commits
anteriores). O conteúdo errado (BaseERP) ficou no working tree, staged,
e acabou sendo commitado como `src/core/brand.ts` "novo" no primeiro
commit automático (`sync(base-erp): ...`) que foi pra produção.

**Corrigido**: conteúdo do `core/brand.ts` do Prisma restaurado
manualmente (nome "Prisma", tagline, cor, `iconPaths` do ícone "gem",
`privacyPolicyHref: "/privacidade"`) a partir do que estava registrado
nesta conversa antes do bug acontecer.

**Correção estrutural** (pra nunca mais poder acontecer, mesmo se uma
entrada de diretório amplo voltar pra `FOUNDATION_PATHS` no futuro):
`sync-to-vertical.sh` e `sync-to-base.sh` ganharam `rsync_excludes_for()`
— monta `--exclude` de VERDADE pro `rsync`, computado a partir de
`FOUNDATION_EXCLUDE_PATHS`, pra qualquer entrada de diretório. Antes,
`FOUNDATION_EXCLUDE_PATHS` só protegia um arquivo se ele fosse
sincronizado como sua PRÓPRIA entrada de `TO_SYNC` — não protegia contra
estar dentro de uma pasta maior sendo copiada. Com a lista atual
(file-level, `core/brand.ts` nunca aninhado dentro de nenhuma entrada de
diretório como `core/profile`), o bug não se repetiria de qualquer
forma — mas o `--exclude` real é defesa em profundidade, não depende de
ninguém lembrar dessa invariante ao editar `foundation-paths.sh` depois.

**Lição mais dura desta sessão**: um `git restore` de emergência,
feito rápido no meio de descobrir um bug, precisa da MESMA atenção que
o bug original — "reverter os arquivos que apareceram na lista de diff"
não é o mesmo que "reverter tudo que o teste sujou", porque um arquivo
NOVO sujado não aparece como "modificado de algo bom conhecido", ele
aparece como "adicionado" — e pode ser fácil de tratar como parte do
que deveria mesmo ser commitado.

## 2026-09-29 — mecano-erp entra na automação de sync; `VERTICAL_PATH_EXCLUDES`

Depois que o mecano-erp migrou pra RLS ativa (`docs/decisoes.md` de lá,
mesma data — deixou de usar `bypassrls`), a arquitetura ficou igual à do
BaseERP/Prisma o suficiente pra entrar na mesma automação. Reconciliados
~25 arquivos de fundação que só divergiam por histórico (comentário
desatualizado citando "mecano-erp usa bypassrls", lógica de módulo
vazada pro `core/backup.ts` — virou o motor genérico
`registerBackupTable()`, igual ao Prisma). Detalhe completo da
reconciliação em `mecano-erp/docs/decisoes.md`, mesma data.
`mecano-erp` adicionado a `scripts/verticals.txt`.

**Mecanismo novo**: `VERTICAL_PATH_EXCLUDES` em
`scripts/foundation-paths.sh` — exceção POR VERTICAL pra um arquivo que
geralmente é fundação mas tem divergência REAL de comportamento só ali
(ex.: mecano-erp tem service worker próprio de verdade, texto de UI
voltado a "oficina" em vez de "organização" — ver a lista completa e o
porquê de cada entrada direto no script). `sync-to-vertical.sh`/
`sync-to-base.sh` passaram a consultar essa lista tanto pra pular um
arquivo inteiro quanto (via `rsync_excludes_for`) pra excluir um arquivo
específico de dentro de uma entrada de DIRETÓRIO.

**Bug real pego na hora**: antes dessa exceção existir, um sync reverso
(mecano-erp → BaseERP) trocou "Acesse o painel da sua organização." por
"...sua oficina." no `login/page.tsx` do BaseERP — o arquivo estava na
lista geral de fundação, mas o texto de UI do mecano-erp é
deliberadamente diferente. Corrigido no commit seguinte, e o arquivo
entrou em `VERTICAL_PATH_EXCLUDES[mecano-erp]`. Lição: um arquivo só
pode ficar em `FOUNDATION_PATHS` se for byte-idêntico em TODOS os
verticais que o herdam, não só nos que já foram checados — texto de UI
(não só lógica) conta como divergência real.

Seção nova em `docs/arquitetura.md` ("Verticais e sincronização de
fundação") documenta o fluxo do dia a dia e o passo a passo de criar um
vertical novo.

## 2026-09-30 — Compartilhar documentos com o cliente (core/share)

Botão único `ShareDocumentButton` (fundação, sincroniza com os verticais)
para enviar orçamento/pedido/OS/nota ao cliente.

- **Snapshot + link público**: cada vertical monta um `ShareDocumentInput`
  (modelo neutro: emissor, cliente, seções, tabela, totais, links) e chama
  `createSharedDocument`. Grava `shared_documents` com o **hash** (sha256) de
  um token de 256 bits; o link `/d/<token>` mostra a página e
  `/d/<token>/pdf` o PDF (`pdf-lib`). O cliente vê o que foi enviado, mesmo
  que o pedido mude depois. Expira em 30 dias e pode ser revogado.
- **Leitura sem sessão**: função `public.get_shared_document(hash)`
  (SECURITY DEFINER, migrations-custom/0007) — só devolve documento não
  expirado/não revogado e conta a visualização. Nenhuma tabela de negócio é
  aberta ao público; `/d/` entrou em `PUBLIC_PATHS` do proxy. Páginas com
  `noindex`, sem cache e `referrer: no-referrer`.
- **Canais**: compartilhar nativo do celular com PDF anexo (Web Share API,
  fallback sem arquivo), WhatsApp (`wa.me` com link — `wa.me` não anexa
  arquivo; DDI 55 assumido), copiar link, baixar PDF e e-mail. E-mail direto
  é **opcional** por organização (`organization_email_settings`, SMTP via
  `nodemailer`, só o dono configura); sem ele o botão abre o `mailto:`.
- **Segredos**: senha SMTP com AES-256-GCM (`core/crypto.ts`,
  `SETTINGS_ENCRYPTION_KEY` fora do banco). Host SMTP bloqueia
  localhost/rede privada (SSRF básico; DNS rebinding não coberto).
- **LGPD**: o snapshot guarda dado pessoal do cliente; por isso expira e é
  revogável. Falta um cron de purga dos expirados (pendência).
- **Não coberto**: anexo automático no WhatsApp (exige API oficial paga).
- Cada vertical precisa: `npm i pdf-lib nodemailer`, `export * from
"./schema/sharing"` em `src/db/schema.ts` e a migration do drizzle +
  `0007_sharing_rls.sql` adaptada ao seu numeral de migrations-custom.

## 2026-09-30 — Mensagem de envio editável + correção do link relativo

- `core/share/template.ts` (puro): modelo com variáveis `{primeiro_nome}`,
  `{numero}`, `{total}`, `{empresa}`, `{link}`… O botão mostra as variáveis
  como botões com nomes em português, insere no cursor e exibe uma prévia
  (bolha de WhatsApp) do texto final, usado em WhatsApp, Telegram, e-mail e
  compartilhamento nativo. Sem `{link}` no texto, o link vai ao final.
  "Salvar como meu padrão" guarda o modelo por tipo de documento em
  `localStorage` (por navegador; compartilhar entre usuários exigiria tabela).
- **Bug**: `NEXT_PUBLIC_SITE_URL=` vazio no `.env.local` virava link relativo
  (`??` não trata string vazia). `core/share/origin.ts#resolveOrigin` usa
  vazio como "não configurado"; coberto por teste.
- Ícones de marca via `simple-icons` (WhatsApp/Telegram); dependência a
  instalar em cada vertical.

## 2026-09-30 — Importar/exportar planilhas (core/spreadsheet)

Infra genérica de planilha, usada pelos cadastros dos verticais (clientes
primeiro). Aceita **.xlsx e .csv** (vírgula ou ponto e vírgula; UTF-8 ou
Windows-1252) na importação e exporta nos dois formatos.

- `exceljs` (servidor): `buildTemplate` gera o modelo com aba "Instruções"
  (o que preencher, obrigatória, exemplo), cabeçalhos coloridos (laranja =
  obrigatória), nota por coluna e **listas suspensas** (tipo, UF…);
  `buildExport` usa o mesmo formato (exportar → editar → importar de volta),
  tudo como texto para o Excel não comer zeros à esquerda; `readSheet` mapeia
  cabeçalhos tolerando acento/caixa/`*`/sinônimos e a chave antiga em inglês.
- Limites: 5 MB e 5.000 linhas por arquivo; erros amigáveis (formato,
  arquivo corrompido/protegido, coluna obrigatória ausente).
- `SpreadsheetImportWizard`: 1) baixar modelo, 2) preencher, 3) enviar →
  **prévia** (prontos / já existem / com problema, com a linha e o motivo)
  → confirmar. Nada grava antes da confirmação. Duplicados: pular ou
  atualizar. `SpreadsheetMenu`: botão "Planilha" das listas.
- Stateless: a confirmação reenvia o arquivo e o servidor revalida tudo (não
  confia na prévia do cliente).
- `core/csv.ts#parseCsv` ganhou o parâmetro `delimiter`.

## 2026-09-30 — Dados da empresa editáveis pelo dono da conta

Os documentos compartilhados (`core/share`) usam o nome/CNPJ/telefone/endereço
da organização, mas o gatilho `restrict_organization_branding_update` impedia o
dono da CONTA de editá-los (só o dono da plataforma). Mudança:
`organizations.display_name` (novo, "Nome nos documentos"; vazio = usa `name`)
e a migration `0008_company_profile_owner_update.sql` recria o gatilho
liberando `display_name`, `document`, `phone` e `address` para o dono da conta.
Continuam restritos ao dono da plataforma: `name`, ramo, status e cobrança.
UI: card "Dados da empresa" em Perfil (`core/profile/components/company-form.tsx`,
`core/profile/company-actions.ts`, só `role === "owner"`). Cada vertical aplica
a migration e passa a ler `displayName ?? name` nos documentos.

## 2026-09-30 — Limpeza dos documentos compartilhados expirados

`shared_documents` guarda dado pessoal do cliente (snapshot). Antes só
expirava (a leitura pública recusa); agora o cron `GET /api/cron/purge-shared`
(`30 6 * * *`, logo depois do backup) apaga o que expirou ou foi revogado há
mais de 7 dias (`core/share/purge.ts`). Mesma proteção do backup
(`CRON_SECRET` + `runWithSystemContext`). A carência de 7 dias deixa o link
"expirado" distinguível de "inexistente" por um tempo e dá margem para
suporte. Backups (`organization_backups`) podem conter o snapshot até a
própria rotação.

## 2026-10-05 — Multiusuário por organização (mono/multi + módulos por pessoa)

**Problema:** todos os verticais eram mono-usuário na prática — o schema
aceitava várias linhas em `memberships`, mas não havia convite, limite de
assentos nem controle do que cada pessoa pode abrir. Objetivo comercial:
vender para pequenas/médias empresas, umas com 1 usuário, outras com vários
usuários e setores, cobrando por empresa.

**Decisões:**

- Dois níveis: o dono da PLATAFORMA libera mono/multi e o limite de pessoas
  (`organizations.multi_user`, `seat_limit`); o dono da CONTA convida e escolhe
  módulos por pessoa. Preço (usuário extra) é decisão comercial fora do
  sistema — `extra_seat_price_cents` é só lembrete.
- Permissão por módulo (ver/não ver), não por papel nem por ação. Evolução
  possível: leitura vs. edição por módulo, se algum cliente pedir.
- A checagem é dupla: Server Action (mensagem amigável) + banco (trigger de
  assentos, policies de owner, RLS ignora membership desativado).
- Convite = criar conta com senha provisória devolvida uma vez (mesmo padrão
  do reset do admin). Sem e-mail transacional. Recusa e-mail já cadastrado.
- `getActiveOrg` separou a leitura de `memberships` da de `organizations`:
  quem foi desativado só enxerga a PRÓPRIA linha (`memberships_select_self`) e
  continua vendo "acesso bloqueado" em vez de "sem organização".
- `get_user_display_info` passou a servir também o dono da conta, só para
  membros de organizações dele (antes: só platform admin).

**Não coberto aqui (próximos passos):** auditoria de negócio (`created_by`/
`updated_by` nas tabelas de módulo), concorrência de edição nos módulos de
cada vertical, e `requireModule` dentro de cada módulo (este template não tem
módulos). Verticais precisam aplicar a migration, trocar `withOrg()` por
`requireModule(slug)` e acrescentar `membership_modules` ao
`hardDeleteOrganization` se não usarem cascade.

## 2026-10-06 — Multiusuário: backup só do responsável, dependências e ModuleGuard

- `requireOwner()` (`core/auth.ts`) protege áreas que não são módulo e dão visão
  da empresa inteira: **Backup** (página, ações e rotas de download, 403 nas
  rotas). Antes, uma pessoa `staff` sem nenhum módulo ainda baixava o backup com
  os dados de todos. O link some do menu (`SidebarNav isOwner`).
- `expandWithDependencies()` (`core/module-access.ts`): ao gravar permissões, a
  lista é fechada sob `dependsOn` de cada `module.ts` (pedidos → clientes). Sem
  isso, a tela de pedido quebrava ao listar clientes para quem só tinha pedidos.
  A tela de equipe mostra "(também libera …)".
- `components/module-guard.tsx`: casca de UX para o `layout.tsx` de cada módulo
  (aviso "Sem acesso" em vez de erro). **Não é a proteção** — essa é
  `requireModule()` em toda Server Action, consulta e rota do módulo.

## 2026-10-06 — Auditoria de negócio e histórico de status

**Problema:** com várias pessoas na mesma empresa, nenhuma tabela de negócio
dizia quem criou ou alterou algo, nem quem mudou o status de uma OS/pedido.

**Decisões:**

- Autoria por GATILHO (`set_audit_columns`), não por código nas actions: é a
  mesma ideia da RLS — falha fechado por padrão, ninguém precisa lembrar. A
  sessão (`app.current_user_id`) sempre vence o valor enviado.
- Sem FK para `auth.users`: apagar uma conta não pode apagar nem travar o
  histórico. A tela mostra "Usuário removido" quando o nome some.
- `status_history` é genérica (`entity_table` + `entity_id`), uma tabela para
  todos os módulos, imutável para membros.
- `get_user_display_info` ampliada: antes só admin/dono da conta; agora qualquer
  membro enxerga nome/e-mail de colegas da MESMA organização (necessário para
  "criado por Fulano"). Nunca de outra organização.
- Infra no BaseERP (migration drizzle `0006_audit_status_history`, custom
  `0010_audit_columns_and_status_history`); aplicada às tabelas de cada vertical
  nas migrations deles. Validado num Postgres em memória (11 cenários: autoria
  forjada, update por outra pessoa, histórico imutável, isolamento entre
  organizações, nomes entre colegas).

## 2026-10-06 — Suporte ao vivo por pessoa, espera configurável e chat

**Problemas:** (1) a sessão de suporte era da ORGANIZAÇÃO: com vários usuários
na empresa, o widget de TODOS entrava na sessão (gravando a própria tela no
mesmo registro) e o controle remoto do suporte valia na tela de todos. (2)
"Chamar suporte" criava um pedido e esperava para sempre, sem dizer ao usuário
que ninguém estava lá e sem avisar o dono. (3) Sem canal de conversa durante o
atendimento.

**Decisões:**

- Sessão por PESSOA: `live_sessions.subject_user_id` (quem tem a tela
  espelhada). RLS passou de `apply_org_rls` (qualquer membro lia/alterava) para
  "só a própria pessoa e o admin"; o canal de aviso é `support-user:<userId>`
  (antes `support-org:<orgId>`). Colega, mesmo o dono da conta, não vê nem
  encerra a sessão do outro.
- Presença do dono: o painel `/admin` aberto e visível bate
  `platform_admins.last_seen_at` a cada ~20 s (`AdminPresenceBeacon`);
  "online" = batida < 45 s, consultada no servidor por
  `any_platform_admin_online()` (SECURITY DEFINER — o usuário não lê
  `platform_admins`). Escolhido em vez de Supabase Presence porque o servidor
  precisa decidir (Telegram) sem depender de um navegador.
- Fluxo do pedido: online → `pending` com `expires_at = agora +
platform_settings.support_wait_seconds` (padrão 30 s, 5–300, editável em
  `/admin`) e contagem na tela do usuário; offline → já nasce `missed`. Ao
  zerar, o navegador chama `expireSupportRequest`, mas QUEM decide é o servidor
  (confere `expires_at`, só troca se ainda `pending`). `missed` → Telegram +
  caixa de entrada do `/admin`. Limitação conhecida: se a pessoa fechar a aba
  durante a contagem, ninguém dispara a expiração — o pedido continua `pending`
  na caixa de entrada do admin (visível), só não gera o Telegram.
- Telegram por variáveis de ambiente (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`):
  o token não fica no banco. Melhor esforço, nunca derruba o pedido. Mensagem só
  com nome da pessoa e da empresa.
- Voltando depois: o admin usa "Pedir acesso à tela" num pedido `missed`; a MESMA
  sessão reabre como pedido do admin e a pessoa precisa APROVAR de novo (o
  pedido pode ter sido horas atrás). Sem aprovação automática.
- Chat: `live_session_messages` (RLS: só quem participa, só com a sessão
  ativa, ninguém edita/apaga). Persistido; o broadcast só acelera e uma releitura
  a cada 10 s cobre broadcast perdido. O papel (admin × usuário) vem do servidor.
- Um "Chamar suporte" repetido em até 5 min de um pedido `missed` não cria outro
  nem manda outro Telegram.

Migrations: drizzle `0007_live_support_per_user`, custom
`0011_live_support_per_user`. Validado num Postgres em memória (28 cenários de
RLS/presença/configuração) e 15 testes unitários (espera, expiração, alerta,
chat, Telegram).

## 2026-10-06 — Espelho do suporte: segundo quadro, "Atualizar tela" e caixa arrastável

**Bug:** depois de a pessoa clicar em "Permitir", o espelho do suporte ficava
preso no aviso "quer ver sua tela". A gravação (rrweb) começa no instante do
clique, com o aviso ainda saindo (animação de saída) — o primeiro quadro já
inclui o aviso. A remoção dele chega logo depois pelo Broadcast, mas o viewer
DESCARTA de propósito os eventos anteriores ao quadro que buscou no banco
(aplicar mutação velha sobre quadro novo corrompe o espelho). Resultado: o aviso
nunca saía. (O "efeito espelhado" nas laterais da imagem é só o
`backdrop-blur` do aviso, que reflete as bordas.)

**Correção:** o widget tira um SEGUNDO quadro completo 1,5 s depois do início
(`record.takeFullSnapshot()`), grava e avisa o viewer (`resync`), que recria o
espelho a partir dele. Mesmo caminho serve ao botão "Atualizar tela" do admin
(`request-snapshot` → a pessoa tira e grava um quadro novo → `resync`) para
qualquer outro descompasso. Só quadros DEPOIS do primeiro disparam `resync`
(o primeiro o viewer já busca sozinho).

**Caixa de conversa arrastável** (`draggable-panel.tsx`): pointer events com
captura (mouse e toque), setas do teclado na barra, nunca sai da janela
(re-ajusta ao redimensionar e ao recolher/expandir). Sem persistência entre
recarregamentos, de propósito (ler `localStorage` na renderização causa
diferença entre servidor e navegador).

## 2026-10-06 — Painel da conversa: arrastável nos dois lados, aviso sonoro e não lidas

`SupportChatPanel` unifica a conversa do usuário e do admin: caixa flutuante
arrastável (`DraggablePanel`), que recolhe, com aviso sonoro de mensagem nova,
título da aba piscando em segundo plano, botão de silenciar e contador de não
lidas recolhida. Fica montada durante toda a sessão ativa e ouve o evento do
tempo real (`chat-events.ts`) — por isso avisa mesmo recolhida; a lista/campo
(`SupportChat`) só existe com o painel aberto.

- Som sintetizado com Web Audio (dois tons), sem arquivo para baixar. O navegador
  só toca depois de a pessoa ter interagido com a página; ela sempre clicou em
  algo para chegar à sessão, então na prática toca. Se recusar, falha em silêncio
  e o contador de não lidas continua avisando.
- Cada mensagem avisa UMA vez (dedupe por id), venha pelo tempo real ou pela
  releitura periódica de segurança (`onIncoming`). O histórico da primeira
  leitura nunca conta como "nova".
- Preferência de som em `localStorage`, lida com `useSyncExternalStore`
  (servidor sempre "ligado") para não divergir do HTML do servidor.
- O admin passou a ver a conversa flutuante (antes ficava fixa abaixo do
  espelho, rolando para fora da tela).

## 2026-10-06 — Caixa de conversa redimensionável e teste do Telegram

- `DraggablePanel` ganhou alças nos cantos superior-esquerdo e inferior-direito
  (pointer events e setas do teclado). Ao mexer, passa de âncora CSS (`right/bottom`)
  para `left/top/width/height`, com mínimo de 240×220 e sempre dentro da janela.
  Recolhida, ignora a altura escolhida e some com as alças. A lista de mensagens
  usa `flex-1 basis-48`: altura própria quando a caixa é automática, preenche o
  espaço quando a caixa tem altura definida.
- `sendTelegramMessageDetailed` devolve o motivo (não configurado, recusado — com a
  descrição do Telegram, que nunca traz o token —, rede). Alimenta o botão "Enviar
  mensagem de teste" do `/admin`, para validar o token e o chat id sem esperar um
  pedido de suporte de verdade.

## 2026-10-07 — Suporte: conversa pelo Telegram e espera por organização

**Pedido:** (1) o dono responder pelo Telegram e a pessoa receber na caixa de
conversa do sistema, com a conversa migrando para o painel quando a tela é
compartilhada, sem a pessoa perceber troca de canal; (2) o tempo de espera ser de
cada organização.

**Modelo:** a SESSÃO é a conversa. `missed` → (dono responde no Telegram) →
`chat` (só texto, sem tela) → (a pessoa aprova ver a tela) → `active`. Mesma
`live_sessions.id` e mesmo `live_session_messages` o tempo todo: o histórico
atravessa a mudança. Em `chat`, o que a pessoa escreve é encaminhado ao Telegram
do dono e o que o dono responde ("Responder") chega na caixa dela; ao virar
`active`, o Telegram recebe "a conversa continua no painel" e deixa de ser o
canal (resposta posterior no Telegram recebe o lembrete). A tela continua exigindo
o consentimento explícito da pessoa (`live_sessions.screen_requested` + modal),
agora também a partir de uma conversa por texto.

**Telegram → sistema** (`/api/telegram/webhook`, `live-support/telegram-bridge.ts`):

- Barreiras, nesta ordem: segredo do cabeçalho (`TELEGRAM_WEBHOOK_SECRET`,
  comparação em tempo constante) → o chat é o do dono (`TELEGRAM_CHAT_ID`; outra
  pessoa que fale com o bot é ignorada em silêncio) → só então vira ação.
- A resposta é gravada como o admin da plataforma (`TELEGRAM_ADMIN_USER_ID` ou o
  mais antigo) via `runWithUserContext`, então a RLS vale também aqui.
- Qual sessão: a da mensagem respondida (`support_telegram_messages` mapeia cada
  mensagem que o servidor mandou ao Telegram → sessão); sem "Responder", a única
  conversa aberta; com várias, o bot pede para responder a uma específica.
- O id de cada mensagem do dono também entra no mapa: é a trava contra o
  Telegram reenviando o mesmo update (chave primária).
- `/fim` encerra a conversa. A decisão do que fazer é a função pura
  `planOwnerReply` (testada).
- Rota sempre devolve 200 depois da primeira barreira: o Telegram reenvia em erro,
  e uma resposta duplicada na conversa é pior que uma perdida.
- Registro do webhook pelo botão "Ativar respostas pelo Telegram" em `/admin`
  (precisa de `NEXT_PUBLIC_SITE_URL` HTTPS; o Telegram não alcança localhost).

**Espera por organização:** `organizations.support_wait_seconds` (5–300, padrão
30; só o dono da plataforma altera — gatilho; campo na ficha da organização).
`platform_settings` ficou sem uso (mantida: a migration custom anterior cria
políticas nela e uma migration que a apagasse quebraria instalações novas, em que
as custom rodam depois de todas as do drizzle).

**Correção de passagem:** `/api/cron/*` não estava em `PUBLIC_PATHS` do proxy —
um GET sem sessão (o Vercel Cron) era redirecionado a `/login` antes de chegar na
rota, então o backup diário e a limpeza de documentos provavelmente nunca rodavam
em produção. Agora `isPublicPath` (testada) libera `/api/cron/` e o webhook; cada
rota se autentica por conta própria (`CRON_SECRET`, segredo do Telegram).

Migrations: drizzle `0008_support_telegram_chat`, custom
`0012_support_telegram_chat`. Validado num Postgres em memória (17 cenários) e 54
testes (regras puras do Telegram, rota do webhook, proxy, painel).

## 2026-10-07 — Teste real do Telegram: webhook velho, túnel e botões do dono

**O que o teste real mostrou** (dados do ngrok, do Telegram e do banco):

1. **Resposta pelo Telegram sem efeito.** O bot estava registrado com
   `https://abc123.ngrok-free.app` (o valor de EXEMPLO do roteiro) — o Telegram
   recebia 404 e a resposta ficou pendente (`pending_update_count = 1`). O clique em
   "Ativar" aconteceu com o servidor ainda usando o `NEXT_PUBLIC_SITE_URL` antigo.
   Registrado o endereço certo (sem descartar a pendente), a resposta foi processada
   (a sessão virou `chat` e a mensagem foi gravada): a ponte funcionava, faltava o
   registro. Correção estrutural: o card do `/admin` agora CONFERE sozinho ao abrir
   e destaca em vermelho quando o bot aponta para outro endereço.
2. **Botões que não respondiam no celular, aberto pelo túnel.** O Next 16 bloqueia em
   desenvolvimento as requisições a recursos internos (HMR/overlay) vindas de
   qualquer endereço que não seja localhost (`allowedDevOrigins`); pelo ngrok a
   página carregava mas o JavaScript não assumia — só passaram ações de formulário
   nativo (login/sair, que funcionam sem JS), nenhuma ação de botão. `next.config.ts`
   agora libera os domínios de túnel (`*.ngrok-free.dev`, `*.ngrok-free.app`,
   `*.ngrok.app`, `*.ngrok.dev`, `*.trycloudflare.com`). Só desenvolvimento.

**Novos controles do dono** (lista de pedidos em `/admin`):

- "Enviar mensagem": escreve à pessoa SEM pedir a tela. O pedido (sem atendimento ou
  esperando) vira conversa por texto — o mesmo caminho do Telegram, agora em
  `chat-service.ts` (um só código para os dois: abre a conversa, grava, avisa).
- "Encerrar": descarta um pedido que não precisa mais (usa `endLiveSession`), com
  confirmação.
- "Cancelar pedido de tela" (no viewer, em conversa por texto): fecha o aviso de
  permissão na tela da pessoa e a conversa segue.

**Aviso de mensagem da pessoa:** `sendSupportMessage` publica `chat-message` no canal
do painel (toast, som e título da aba em QUALQUER página do `/admin`) e só encaminha
ao Telegram se nenhum admin está online — evita avisar duas vezes quem já está olhando
o painel, e garante que quem saiu do painel receba no celular.

Sem migration nova. Testes novos: serviço de mensagem do dono, caixa de entrada e o
widget do usuário (abre a conversa quando o suporte responde, aviso de tela, recusar
sem fechar, aprovar na mesma sessão, aviso "offline" que sai quando a resposta chega).

## 2026-10-07 — Controle remoto pelo celular do dono: teclado que sumia

**Sintoma:** com o controle remoto liberado, o dono no celular tocava num campo da tela
da pessoa e o teclado aparecia e sumia na hora; não dava para escrever.

**Causa:** duas coisas. (1) Ao repetir o "foco" gravado na pessoa, o rrweb focava o
iframe do espelho (`triggerFocus`, padrão ligado) — no celular isso ABRE o teclado — e
um intervalo de 100 ms (feito para o teclado do computador chegar na janela) tirava o
foco do iframe: o teclado fechava 100 ms depois. (2) Mesmo sem isso, o teclado virtual só
aparece para um campo REAL e focado, e muitos teclados (Gboard) nem informam a tecla no
`keydown` (vem `Unidentified`), então o repasse de teclas por `keydown` não servia.

**Correção:**

- Replayer com `triggerFocus: false` (o destaque do campo focado continua — vem do
  evento `mouse-interaction`, emitido antes da checagem de foco). O intervalo que tirava
  o foco do iframe saiu.
- Campo "Digitar na tela da pessoa" (`remote-typing-input.tsx`), visível com o controle
  liberado. No celular, um toque no espelho leva o foco para ele dentro do gesto do
  toque (exigência para abrir o teclado). O que muda no campo vira
  `{ type: "text", text, deleteCount }` (`computeTextDelta`: prefixo comum), então
  funciona para digitar, apagar, colar e para a correção automática de palavra
  ("cafe" → "café"). `applyControlEvent` aplica no campo focado da pessoa com o setter
  nativo (o React enxerga a mudança). Enter envia a tecla Enter e limpa.
- O `keydown` da janela não repassa tecla enquanto esse campo está focado (evita
  duplicar).

**Limite conhecido:** rolar a tela da pessoa continua só pela roda do mouse; no toque, o
gesto de arrastar rola o espelho localmente, não a página dela.

**Aviso de hidratação:** `<body suppressHydrationWarning>` nos três layouts — extensões
(ColorZilla injeta `cz-shortcut-listen`, gerenciadores de senha, tradutores) mudam o
`<body>` antes de o React assumir e geravam um erro de console que não é bug do sistema.

## 2026-10-07 — Suporte ao vivo em celular em pé: controles que estouravam a tela

Em largura estreita (celular em pé) vários controles do suporte ficavam fora da tela:
a barra do viewer do dono (selo de estado + zoom + "Atualizar tela" + "Encerrar") era
uma linha única sem quebra; a barra "Sessão de suporte ativa" da pessoa tinha o texto
longo e o grupo "Controle remoto + Encerrar" (`shrink-0`) na mesma linha; os cartões
fixos (aviso "suporte offline", espera pelo atendimento) não tinham largura máxima e,
ancorados à direita, passavam da borda esquerda.

Regra adotada para os controles do suporte: barras com `flex-wrap`; texto longo com
`min-w-0` (e `basis-*`) para ceder espaço; selos de estado com `whitespace-normal`;
cartões fixos com `max-w-[calc(100vw-2rem)]`; no cabeçalho da caixa de conversa, o título
trunca e o grupo de ícones é `shrink-0`. Testes de classe garantem a regra
(`live-session-viewer.test.tsx`, `live-support-widget.test.tsx`,
`support-chat-panel.test.tsx`) — é uma checagem de estrutura, não de pixels: a prova
final é abrir no celular.

## 2026-10-07 — Controle remoto pelo celular: teclado só em campo, texto existente e rolagem

Três defeitos do teste real no celular, todos no viewer do dono:

1. **Teclado abria em qualquer toque.** `handleClick` levava o foco ao campo de digitação a
   cada toque. Agora `remote-field.ts` descobre o que há no ponto tocado DENTRO do iframe do
   espelho (`elementAtFraction` converte a fração do toque em pixels da tela gravada,
   independente do zoom) e `readEditableField` decide: só `<input>` de tipo texto
   (text/search/email/url/tel/password/number), `<textarea>` e contenteditable abrem o teclado;
   checkbox, radio, botão, arquivo, cor, data, leitura-apenas e desativado não; tocar em
   qualquer outra coisa ainda FECHA o teclado. Os elementos do iframe são de outro documento
   (`instanceof` falha entre documentos), então tudo é checado por `tagName`/propriedades.
2. **Não dava para apagar o texto que o campo já tinha.** O campo de digitação começava
   vazio e o delta era relativo a ele (Backspace num campo vazio não gera evento). Agora o
   toque faz o campo COMEÇAR com o valor do campo remoto (`RemoteTypingHandle.setBase`), então
   apagar/colar/digitar é relativo ao texto real. Botão "Limpar campo" apaga tudo.
3. **Rolar a tela da pessoa pelo celular.** Só a roda do mouse rolava a página dela. Com o
   controle liberado, arrastar o dedo no espelho manda `scroll` (movimento ÷ zoom, porque o
   espelho pode estar reduzido; dedo para cima = página para baixo; envio a cada 40 ms);
   abaixo de 8 px é toque, e o clique que o navegador dispara depois de um arrasto é ignorado
   (a trava solta em 400 ms para nunca engolir um toque verdadeiro). `touch-action: none` só
   com o controle liberado — sem ele o espelho continua rolando localmente. Botões ↑/↓ rolam
   300 px da página dela (também no computador).

Limite: o texto é editado no FIM do campo (não há cursor remoto no meio da frase).

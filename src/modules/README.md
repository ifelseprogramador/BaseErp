# Contrato de um módulo

Este diretório começa vazio de propósito: BaseERP é um projeto-template,
sem nenhum módulo de negócio (nada de clientes, veículos, produtos,
pedidos — isso é trabalho de um vertical nascido a partir deste
template). Quando um módulo de negócio for criado, ele deve seguir este
contrato de arquivos, o mesmo já validado em produção no projeto de
referência (mecano-erp):

```
src/modules/<modulo>/
├── module.ts          # registro via registerModule() — metadados do menu
├── schema.ts          # tabelas Drizzle — SEMPRE com organizationId
├── schema.types.ts     # tipos inferidos do schema (Select/Insert)
├── validation.ts       # Zod — única fonte de validação (form + Server Action)
├── queries.ts          # leitura — sempre via withOrg()#withDb
├── actions.ts           # Server Actions — sempre retornam ActionResult
├── index.ts             # barrel — único ponto importável de fora do módulo
├── components/          # componentes React do módulo
└── __tests__/            # testes unitários ao lado do código
```

## Regras

1. **`organizationId` obrigatório.** Toda tabela de módulo tem
   `organizationId` (referenciando `organizations.id`) e uma migration
   custom em `src/db/migrations-custom/` chamando
   `select public.apply_org_rls('nome_da_tabela');` — nunca declare RLS
   via `pgPolicy` no schema Drizzle (ver docs/decisoes.md, "por que RLS
   fica fora do drizzle-kit").

2. **Toda leitura/escrita passa por `withOrg()`.** Nunca importe
   `core/db.ts#db` direto dentro de um módulo — com RLS ativa, ele
   simplesmente não enxerga nada sem o contexto de usuário. Use:

   ```ts
   const { organizationId, withDb, log } = await withOrg();
   return withDb((tx) =>
     tx.query.exemplo.findMany({ where: eq(exemplo.organizationId, organizationId) }),
   );
   ```

3. **`ActionResult` em toda Server Action.** Nunca deixe um `throw`
   escapar para o form — sempre `{ ok, errors?, message? }` (ver
   `core/action-result.ts`).

4. **Validação única via Zod**, compartilhada entre o form
   (`react-hook-form` + `@hookform/resolvers/zod`) e a Server Action —
   nunca duas fontes de verdade sobre o que é um dado válido.

5. **Dinheiro sempre em centavos** (`Cents`, `core/money.ts`) — nunca
   `number` fracionário.

6. **Ícones como `iconName` (string), nunca componente.**
   `ModuleDefinition.iconName` é lido por Server Components e passado
   para Client Components (sidebar/drawer) — React não serializa uma
   função nessa fronteira. `core/resolve-icon.tsx` resolve a string para
   o componente do lado do cliente.

7. **Logger estruturado, nunca `console.*`.** O ESLint bloqueia
   `console.*` fora de `core/logger.ts` — use `log` (de `withOrg()`) ou
   `logger` (de `@/core/logger`) com contexto.

8. **Regra de acoplamento entre módulos**: um módulo só pode importar de
   `@/core/*`, `@/components/ui/*` e do **barrel** (`index.ts`) de outro
   módulo — nunca de um arquivo interno de outro módulo (ex.:
   `@/modules/clientes/schema` de dentro de `modules/ordens/` é proibido;
   `@/modules/clientes` — o barrel — é permitido, e só se `clientes`
   exportar o que for preciso ali). Isso mantém cada módulo removível
   apagando a pasta + tirando a linha de `core/load-modules.ts`, sem
   quebrar import nenhum em outro lugar por acidente.

   **Exceção restrita a `schema.ts` → `schema.ts`**: o Drizzle exige o
   objeto `pgTable` real (não um tipo/barrel) para declarar uma foreign
   key via `references(() => outraTabela.id)`. Por isso `schema.ts` de um
   módulo PODE importar `schema.ts` de outro módulo diretamente — nunca o
   barrel deve reexportar a tabela crua (isso vazaria a tabela para
   qualquer um fazer query direta, fora de `withOrg()`/`withDb`). Fora de
   `schema.ts`, a regra acima vale sem exceção (nota trazida do vertical
   Prisma, `modules/pedidos/schema.ts` — ver docs/decisoes.md).

9. **`registerModule()` em `module.ts`**, importado uma única vez a
   partir de `core/load-modules.ts` (o único arquivo que conhece a lista
   de módulos instalados).

10. **`businessType` de `organizations` nunca é lido por um módulo.** É
    um preset informativo (usado só na tela de criar organização em
    `/admin`, para sugerir quais módulos habilitar por padrão) — ver o
    comentário em `src/db/schema/tenancy.ts`. Um módulo nunca deve ter
    `if (org.businessType === "x")`; comportamento condicional por ramo
    de negócio deve ser configuração própria do módulo, não uma leitura
    deste campo.

11. **Teste unitário para toda lógica não trivial** ao lado do código
    (`__tests__/`), desde o primeiro commit do módulo — não é uma etapa
    separada de "depois eu testo".

12. **`@tanstack/react-table` nunca deve ser usado** (decisão mantida do
    projeto de referência) — tabelas com componentes shadcn puros
    (`components/ui/table.tsx`).

## Dashboard

Um módulo que queira aparecer no painel (`app/(app)/page.tsx`) exporta
uma função `get<Modulo>DashboardSummary()` pelo seu barrel — o dashboard
hoje é só um shell com placeholders (ver comentário em
`app/(app)/page.tsx`) porque não há módulo nenhum ainda para alimentá-lo.

## Backup

Um módulo cujas tabelas devem entrar no backup/restore por organização
(`core/backup.ts`) chama `registerBackupTable({ key, table, dateColumns })`
a partir do próprio `module.ts`.

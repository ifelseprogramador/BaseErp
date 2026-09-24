<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# BaseERP

Projeto-TEMPLATE (não uma aplicação final) — fundação multi-tenant de um
ERP modular, sem nenhum módulo de negócio. Ver `docs/README.md` para a
documentação viva (arquitetura, decisões técnicas) e
`src/modules/README.md` para o contrato de arquivos que todo módulo
futuro deve seguir.

**Regra de trabalho neste projeto**: atualizar `docs/arquitetura.md`
e/ou `docs/decisoes.md` junto de qualquer mudança relevante de código —
não deixar a documentação para o fim.

**Regra de manutenção (peça central deste template)**: sempre que uma
correção ou melhoria for feita numa peça que pertence ao
core/tenancy/RLS/admin enquanto se trabalha num vertical nascido deste
template, essa mudança deve ser replicada de volta para o BaseERP.

**RLS ativa**: diferente do projeto de referência (mecano-erp), aqui a
Row-Level Security do Postgres é a proteção ativa, não só defesa em
profundidade — toda query de módulo passa por `withOrg()#withDb` (nunca
`core/db.ts#db` direto). Ver docs/decisoes.md antes de mexer em
`core/auth.ts`, `core/admin-auth.ts`, `core/db.ts` ou em
`src/db/migrations-custom/`.

Antes de mexer em roteamento, Server Actions, middleware ou qualquer API
do Next.js: este projeto está no Next.js 16, que tem breaking changes em
relação a versões anteriores (ex.: `middleware.ts` virou `proxy.ts`). Ver
`node_modules/next/dist/docs/` e `docs/decisoes.md` antes de assumir uma
API de treino desatualizada.

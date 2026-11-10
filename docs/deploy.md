# Checklist de deploy — BaseERP

Rodar na ordem. Nada aqui é automático: cada passo que mexe em banco ou em produção é decisão de quem faz o deploy.

## 1. Antes do push

- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run test` e `npm run build` passando.
- [ ] `src/core/changelog.ts` e `package.json#version` batem (o teste `changelog.test.ts` confere).
- [ ] Este projeto é o template: não tem banco próprio configurado; o checklist vale para o vertical que nascer dele.

## 2. Banco (ANTES do deploy do código)

O código novo lê colunas/tabelas novas: aplicar a migration primeiro evita erro de coluna inexistente.

- [ ] `npm run db:migrate` com `DATABASE_MIGRATION_URL` apontando para o banco de **produção**.
- [ ] Conferir: `organization_backup_settings` tem `reminder_hours` e `last_download_at`; existe a tabela `login_events`.
- Se o banco de desenvolvimento e o de produção forem o mesmo, a migration já pode estar aplicada.

## 3. Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável                                                                                 | Para quê                                                                          |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `DATABASE_URL`, `DATABASE_MIGRATION_URL`                                                 | banco (papel de app e papel de migração)                                          |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase                                                                          |
| `CRON_SECRET`                                                                            | protege `/api/cron/*` (backup diário, limpeza). Sem ele o cron responde 401       |
| `NEXT_PUBLIC_SITE_URL`                                                                   | endereço público HTTPS (**https://<seu-dominio>**) — usado no webhook do Telegram |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`                      | aviso/resposta do suporte pelo Telegram (um bot por sistema)                      |

## 4. Depois do deploy

- [ ] Entrar em `/admin` → cartão **Telegram do atendimento** → **Ativar respostas pelo Telegram**.
- [ ] Disparar o cron de backup uma vez para gerar backups novos e completos:
      `curl -H "Authorization: Bearer $CRON_SECRET" https://<dominio>/api/cron/backup`
      (resposta esperada: `{"total":N,"succeeded":N,"failed":0}`).
- [ ] Conferir que o backup tem conteúdo (SQL):
      `select o.name, (select string_agg(k || ':' || jsonb_array_length(b.data->'tables'->k->'rows'), ', ') from jsonb_object_keys(b.data->'tables') k) from organization_backups b join organizations o on o.id = b.organization_id order by b.created_at desc limit 5;`
      — a coluna de tabelas **não pode ser nula**.
- [ ] Fazer login e abrir `/admin`: o cartão **Histórico de acessos** deve mostrar o login (a localização só aparece em produção).
- [ ] Teste de restauração: baixar um backup, apagar um registro de teste e restaurar (a restauração só preenche o que não existe; **não** copia dados entre organizações do mesmo banco).

## 5. Observações

- Backups automáticos gerados antes desta versão podem estar vazios/incompletos; o primeiro ciclo novo os substitui (guarda os últimos 7 por organização).
- IP e localização do histórico de acessos são dados pessoais (LGPD): citar na política de privacidade e limpar de tempos em tempos.
- O botão Voltar do navegador/celular não dispara o aviso de alterações não salvas.

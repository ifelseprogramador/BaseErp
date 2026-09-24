/**
 * Lê uma variável de ambiente obrigatória, lançando um erro claro se
 * faltar. Evita repetir o mesmo `if (!x) throw` em cada arquivo.
 *
 * ATENÇÃO — só use isto em código que roda no servidor (Server Component,
 * Server Action, Route Handler, proxy.ts, scripts). Para uma variável
 * `NEXT_PUBLIC_*` que precisa existir dentro do navegador, NÃO use
 * `requireEnv`/`process.env[name]` — o Next.js só consegue embutir o
 * valor no bundle do cliente quando vê o acesso escrito literalmente
 * (`process.env.NEXT_PUBLIC_X`). Um acesso dinâmico por string vira
 * `undefined` em tempo de execução no navegador, sem erro nenhum até
 * alguém tentar usar o valor. Ver `core/supabase/client.ts` e
 * docs/decisoes.md ("process.env dinâmico").
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} não configurada. Copie .env.example para .env.local.`);
  }
  return value;
}
